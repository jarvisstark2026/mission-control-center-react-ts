use std::{
    collections::BTreeMap,
    fs,
    io::{Read, Write},
    net::{SocketAddr, TcpListener, TcpStream, ToSocketAddrs},
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

type DesktopState = BTreeMap<String, String>;

const STATE_FILE_NAME: &str = "mission-control-state.json";
const LOCAL_AGENT_BRIDGE_URL: &str = "http://127.0.0.1:8787";
const LOCAL_AGENT_BRIDGE_BIND: &str = "127.0.0.1:8787";

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalAgentBridgeProcessState {
    available: bool,
    running: bool,
    pid: Option<u32>,
    bridge_url: String,
    hermes_api_base_url: String,
    last_started_at: Option<String>,
    last_error: Option<String>,
}

#[derive(Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartAgentBridgeRequest {
    hermes_api_base_url: String,
    hermes_model: String,
}

struct LocalBridgeRuntime {
    running: bool,
    stop_flag: Option<Arc<AtomicBool>>,
    hermes_api_base_url: String,
    hermes_model: String,
    last_started_at: Option<String>,
    last_error: Option<String>,
}

struct LocalBridgeManager {
    runtime: Mutex<LocalBridgeRuntime>,
}

impl LocalBridgeManager {
    fn new() -> Self {
        Self {
            runtime: Mutex::new(LocalBridgeRuntime {
                running: false,
                stop_flag: None,
                hermes_api_base_url: "http://127.0.0.1:8642/v1".to_string(),
                hermes_model: "hermes-agent".to_string(),
                last_started_at: None,
                last_error: None,
            }),
        }
    }
}

fn state_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&app_data_dir).map_err(|error| error.to_string())?;
    Ok(app_data_dir.join(STATE_FILE_NAME))
}

fn read_state(app: &AppHandle) -> Result<DesktopState, String> {
    let path = state_path(app)?;
    if !path.exists() {
        return Ok(DesktopState::new());
    }

    let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

fn write_state(app: &AppHandle, state: &DesktopState) -> Result<(), String> {
    let path = state_path(app)?;
    let raw = serde_json::to_string_pretty(state).map_err(|error| error.to_string())?;
    fs::write(path, raw).map_err(|error| error.to_string())
}

#[tauri::command]
fn load_app_state(app: AppHandle) -> Result<DesktopState, String> {
    read_state(&app)
}

#[tauri::command]
fn write_app_state(app: AppHandle, key: String, value: String) -> Result<(), String> {
    let mut state = read_state(&app)?;
    state.insert(key, value);
    write_state(&app, &state)
}

#[tauri::command]
fn remove_app_state(app: AppHandle, key: String) -> Result<(), String> {
    let mut state = read_state(&app)?;
    state.remove(&key);
    write_state(&app, &state)
}

fn now_iso() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

fn process_state(runtime: &LocalBridgeRuntime) -> LocalAgentBridgeProcessState {
    LocalAgentBridgeProcessState {
        available: true,
        running: runtime.running,
        pid: if runtime.running { Some(std::process::id()) } else { None },
        bridge_url: LOCAL_AGENT_BRIDGE_URL.to_string(),
        hermes_api_base_url: runtime.hermes_api_base_url.clone(),
        last_started_at: runtime.last_started_at.clone(),
        last_error: runtime.last_error.clone(),
    }
}

fn normalize_hermes_api_base_url(value: &str) -> String {
    let trimmed = value.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return "http://127.0.0.1:8642/v1".to_string();
    }
    trimmed.to_string()
}

fn normalize_hermes_model(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        "hermes-agent".to_string()
    } else {
        trimmed.to_string()
    }
}

fn http_response(status: &str, content_type: &str, body: &str) -> Vec<u8> {
    let headers = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET,POST,OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, Accept\r\n\r\n",
        body.as_bytes().len()
    );
    [headers.as_bytes(), body.as_bytes()].concat()
}

fn send_json(stream: &mut TcpStream, status: &str, payload: serde_json::Value) {
    let body = serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".to_string());
    let _ = stream.write_all(&http_response(status, "application/json; charset=utf-8", &body));
}

fn send_options(stream: &mut TcpStream) {
    let _ = stream.write_all(&http_response("204 No Content", "application/json; charset=utf-8", ""));
}

fn parse_http_request(stream: &mut TcpStream) -> Result<(String, String, String), String> {
    let mut buffer = Vec::new();
    let mut chunk = [0_u8; 4096];
    stream
        .set_read_timeout(Some(Duration::from_secs(3)))
        .map_err(|error| error.to_string())?;

    loop {
        let read = stream.read(&mut chunk).map_err(|error| error.to_string())?;
        if read == 0 {
            break;
        }
        buffer.extend_from_slice(&chunk[..read]);
        if buffer.windows(4).any(|window| window == b"\r\n\r\n") {
            break;
        }
        if buffer.len() > 1_000_000 {
            return Err("Request headers too large.".to_string());
        }
    }

    let header_end = buffer
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .map(|index| index + 4)
        .ok_or_else(|| "Invalid HTTP request.".to_string())?;
    let header_text = String::from_utf8_lossy(&buffer[..header_end]);
    let mut lines = header_text.lines();
    let request_line = lines.next().ok_or_else(|| "Missing request line.".to_string())?;
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or_default().to_string();
    let path = parts.next().unwrap_or_default().to_string();
    let mut content_length = 0_usize;

    for line in lines {
        if let Some((name, value)) = line.split_once(':') {
            if name.trim().eq_ignore_ascii_case("content-length") {
                content_length = value.trim().parse::<usize>().unwrap_or(0);
            }
        }
    }

    let mut body = buffer[header_end..].to_vec();
    while body.len() < content_length {
        let read = stream.read(&mut chunk).map_err(|error| error.to_string())?;
        if read == 0 {
            break;
        }
        body.extend_from_slice(&chunk[..read]);
    }

    Ok((method, path, String::from_utf8_lossy(&body[..content_length.min(body.len())]).to_string()))
}

struct SimpleHttpResponse {
    status_code: u16,
    body: String,
}

fn decode_chunked_body(raw: &[u8]) -> Vec<u8> {
    let mut index = 0_usize;
    let mut decoded = Vec::new();

    while index < raw.len() {
        let Some(line_end) = raw[index..].windows(2).position(|window| window == b"\r\n") else {
            break;
        };
        let size_line = String::from_utf8_lossy(&raw[index..index + line_end]);
        let size_text = size_line.split(';').next().unwrap_or("0").trim();
        let size = usize::from_str_radix(size_text, 16).unwrap_or(0);
        index += line_end + 2;
        if size == 0 {
            break;
        }
        if index + size > raw.len() {
            break;
        }
        decoded.extend_from_slice(&raw[index..index + size]);
        index += size + 2;
    }

    decoded
}

fn parse_http_url(url: &str) -> Result<(String, u16, String), String> {
    let trimmed = url.trim();
    let without_scheme = trimmed
        .strip_prefix("http://")
        .ok_or_else(|| "Only http:// Hermes API URLs are supported by the bundled local bridge.".to_string())?;
    let (host_port, path) = without_scheme
        .split_once('/')
        .map(|(host, path)| (host, format!("/{path}")))
        .unwrap_or((without_scheme, "/".to_string()));
    let (host, port) = if let Some((host, port)) = host_port.rsplit_once(':') {
        (host.to_string(), port.parse::<u16>().map_err(|_| "Invalid Hermes API port.".to_string())?)
    } else {
        (host_port.to_string(), 80)
    };

    if host.is_empty() {
        return Err("Hermes API host is empty.".to_string());
    }

    Ok((host, port, path))
}

fn http_request(method: &str, url: &str, body: Option<&str>, content_type: Option<&str>) -> Result<SimpleHttpResponse, String> {
    let (host, port, path) = parse_http_url(url)?;
    let addr = (host.as_str(), port)
        .to_socket_addrs()
        .map_err(|error| error.to_string())?
        .next()
        .ok_or_else(|| "Hermes API host did not resolve.".to_string())?;
    let mut stream = TcpStream::connect_timeout(&addr, Duration::from_secs(8)).map_err(|error| error.to_string())?;
    stream.set_read_timeout(Some(Duration::from_secs(120))).map_err(|error| error.to_string())?;
    stream.set_write_timeout(Some(Duration::from_secs(10))).map_err(|error| error.to_string())?;

    let payload = body.unwrap_or("");
    let request = format!(
        "{method} {path} HTTP/1.1\r\nHost: {host}:{port}\r\nAccept: application/json\r\n{}Content-Length: {}\r\nConnection: close\r\n\r\n{}",
        content_type
            .map(|value| format!("Content-Type: {value}\r\n"))
            .unwrap_or_default(),
        payload.as_bytes().len(),
        payload
    );
    stream.write_all(request.as_bytes()).map_err(|error| error.to_string())?;

    let mut raw = Vec::new();
    stream.read_to_end(&mut raw).map_err(|error| error.to_string())?;
    let header_end = raw
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .map(|index| index + 4)
        .ok_or_else(|| "Hermes API returned an invalid HTTP response.".to_string())?;
    let header_text = String::from_utf8_lossy(&raw[..header_end]);
    let status_code = header_text
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|code| code.parse::<u16>().ok())
        .unwrap_or(0);
    let is_chunked = header_text
        .lines()
        .any(|line| line.to_ascii_lowercase().starts_with("transfer-encoding:") && line.to_ascii_lowercase().contains("chunked"));
    let body_bytes = if is_chunked {
        decode_chunked_body(&raw[header_end..])
    } else {
        raw[header_end..].to_vec()
    };

    Ok(SimpleHttpResponse {
        status_code,
        body: String::from_utf8_lossy(&body_bytes).to_string(),
    })
}

fn check_hermes_api(hermes_api_base_url: &str) -> (bool, String) {
    let base = hermes_api_base_url.trim_end_matches('/');
    let models_url = format!("{base}/models");
    match http_request("GET", &models_url, None, None) {
        Ok(response) if (200..300).contains(&response.status_code) => (true, format!("{} OK", response.status_code)),
        Ok(response) => (false, format!("{models_url} returned {}", response.status_code)),
        Err(error) => (false, format!("{models_url} failed: {error}")),
    }
}

fn create_bridge_status(hermes_api_base_url: &str, hermes_model: &str, request_count: u64, last_started_at: &str) -> serde_json::Value {
    let (connected, detail) = check_hermes_api(hermes_api_base_url);
    let timestamp = now_iso();
    serde_json::json!({
        "status": if connected { "connected" } else { "offline" },
        "provider": "hermes",
        "activeEngine": format!("Hermes Agent API {hermes_model}"),
        "activeAgentId": "hermes-coordinator",
        "currentTask": if connected {
            "Connected to Hermes Agent and ready to stage Mission Control proposals.".to_string()
        } else {
            format!("Waiting for Hermes API at {hermes_api_base_url}. {detail}")
        },
        "capabilities": ["status", "events", "tasks", "mission-control-events", "json-surface", "hermes-chat-completions"],
        "lastSeenAt": timestamp,
        "agents": [{
            "id": "hermes-coordinator",
            "name": "Hermes Coordinator",
            "specialty": "coordinator",
            "provider": "hermes",
            "model": hermes_model,
            "profile": "home-operator",
            "status": if connected { "available" } else { "limited" },
            "connection": if connected { "online" } else { "offline" },
            "summary": "Receives Mission Control tasks, asks Hermes Agent, and stages pending Command Inbox proposals.",
            "visibleTo": ["admin", "support", "home"]
        }],
        "jobs": [{
            "id": "hermes-api-health",
            "name": "Hermes API health",
            "kind": "monitor",
            "status": "active",
            "cadence": "every request / heartbeat",
            "lastRunAt": timestamp,
            "nextRunAt": timestamp,
            "owner": "Hermes Coordinator",
            "safeForHome": true,
            "description": format!("Checks Hermes Agent API at {hermes_api_base_url}."),
            "visibleTo": ["admin", "support", "home"]
        }],
        "permissions": [
            {
                "id": "hermes-read-context",
                "label": "Read Mission Control task context",
                "category": "workspace",
                "level": "read",
                "risk": "low",
                "description": "Reads task objective, role, risk, goal ID, and evidence IDs sent by Mission Control.",
                "visibleTo": ["admin", "support", "home"]
            },
            {
                "id": "hermes-stage-proposals",
                "label": "Stage command proposals",
                "category": "commands",
                "level": "suggest",
                "risk": "medium",
                "description": "Can create pending Command Inbox proposals, but cannot execute actions directly.",
                "visibleTo": ["admin", "support", "home"]
            }
        ],
        "usage": {
            "requestCount": request_count,
            "approvedActionCount": 0,
            "rejectedActionCount": 0,
            "blockedActionCount": 0,
            "estimatedTokens": 0,
            "estimatedCostUsd": 0,
            "windowStartedAt": last_started_at
        },
        "activity": [{
            "id": "hermes-bridge-status",
            "kind": "connection",
            "title": if connected { "Hermes API connected" } else { "Hermes API offline" },
            "detail": if connected { format!("Forwarding Mission Control tasks to {hermes_api_base_url}.") } else { detail },
            "timestamp": timestamp,
            "source": "mission-control-local-agent-bridge",
            "status": if connected { "succeeded" } else { "failed" },
            "visibleTo": ["admin", "support", "home"]
        }]
    })
}

fn extract_hermes_content(payload: &serde_json::Value) -> String {
    let Some(choice) = payload.get("choices").and_then(|choices| choices.as_array()).and_then(|choices| choices.first()) else {
        return String::new();
    };
    if let Some(content) = choice.pointer("/message/content").and_then(|content| content.as_str()) {
        return content.trim().to_string();
    }
    if let Some(content) = choice.get("text").and_then(|content| content.as_str()) {
        return content.trim().to_string();
    }
    String::new()
}

fn string_field(value: &serde_json::Value, field: &str, fallback: &str) -> String {
    value
        .get(field)
        .and_then(|item| item.as_str())
        .filter(|item| !item.trim().is_empty())
        .unwrap_or(fallback)
        .trim()
        .to_string()
}

fn safe_scope(value: &str) -> &str {
    match value {
        "household" | "system" | "support" | "security" => value,
        _ => "system",
    }
}

fn safe_risk(value: &str) -> &str {
    match value {
        "safe" | "elevated" | "critical" => value,
        _ => "safe",
    }
}

fn create_slug(value: &str) -> String {
    let slug = value
        .to_ascii_lowercase()
        .chars()
        .map(|character| if character.is_ascii_alphanumeric() { character } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if slug.is_empty() {
        "task".to_string()
    } else {
        slug.chars().take(32).collect()
    }
}

fn truncate(value: &str, max_len: usize) -> String {
    if value.chars().count() <= max_len {
        return value.to_string();
    }
    format!("{}...", value.chars().take(max_len.saturating_sub(3)).collect::<String>().trim())
}

fn create_task_result(request: serde_json::Value, hermes_api_base_url: &str, hermes_model: &str) -> Result<serde_json::Value, String> {
    let timestamp = now_iso();
    let objective = string_field(&request, "objective", "Review Mission Control task");
    let title = truncate(&objective, 58);
    let scope = safe_scope(&string_field(&request, "scope", "system")).to_string();
    let risk = safe_risk(&string_field(&request, "risk", "safe")).to_string();
    let agent_id = string_field(&request, "targetAgentId", "hermes-coordinator");
    let request_id = string_field(&request, "id", &create_slug(&objective));
    let evidence_ids = request
        .get("evidenceIds")
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(|item| serde_json::Value::String(item.to_string())))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let messages = serde_json::json!([
        {
            "role": "system",
            "content": "You are Hermes connected to Mission Control. Reply with a concise operational proposal only. Do not claim that actions were executed. Mission Control Command Inbox is the only execution gate. Include reasoning, expected result, and any evidence needed."
        },
        {
            "role": "user",
            "content": format!("Create a Mission Control Command Inbox proposal for this task:\n{}", serde_json::to_string_pretty(&request).unwrap_or_else(|_| "{}".to_string()))
        }
    ]);
    let hermes_body = serde_json::json!({
        "model": hermes_model,
        "stream": false,
        "messages": messages
    });
    let chat_url = format!("{}/chat/completions", hermes_api_base_url.trim_end_matches('/'));
    let response = http_request(
        "POST",
        &chat_url,
        Some(&serde_json::to_string(&hermes_body).map_err(|error| error.to_string())?),
        Some("application/json"),
    )?;
    if !(200..300).contains(&response.status_code) {
        return Err(format!("Hermes API returned {}: {}", response.status_code, truncate(&response.body, 260)));
    }
    let payload: serde_json::Value = serde_json::from_str(&response.body).map_err(|error| error.to_string())?;
    let content = extract_hermes_content(&payload);
    if content.is_empty() {
        return Err("Hermes API returned no assistant content.".to_string());
    }

    let command_id = format!("hermes-task-{}-{}", create_slug(&request_id), OffsetDateTime::now_utc().unix_timestamp());
    let reasoning = truncate(&content, 900);
    Ok(serde_json::json!({
        "message": {
            "id": format!("message-{command_id}"),
            "author": "agent",
            "body": format!("{reasoning}\n\nReview the staged command in Command Inbox before anything can execute."),
            "timestamp": timestamp
        },
        "proposals": [{
            "id": format!("proposal-{command_id}"),
            "commandId": command_id,
            "title": title,
            "reasoning": reasoning,
            "risk": risk,
            "scope": scope,
            "agentId": agent_id,
            "agentName": "Hermes Coordinator",
            "timestamp": timestamp
        }],
        "missionControlEvents": [
            {
                "type": "command",
                "command": {
                    "id": command_id,
                    "title": title,
                    "summary": objective,
                    "source": "agent-bridge:hermes",
                    "goalId": request.get("goalId").and_then(|value| value.as_str()),
                    "evidenceIds": evidence_ids,
                    "agent": {
                        "agentId": agent_id,
                        "agentName": "Hermes Coordinator",
                        "profile": "home-operator"
                    },
                    "reasoning": reasoning,
                    "expectedResult": "Mission Control stores this Hermes response as a pending command proposal and waits for human approval.",
                    "scope": scope,
                    "risk": risk,
                    "status": "pending",
                    "requestedAt": timestamp,
                    "execution": {
                        "status": "not-started",
                        "result": "Waiting in Command Inbox for human approval.",
                        "rollbackAvailable": risk == "safe"
                    },
                    "auditTrail": [{
                        "id": format!("audit-{command_id}-proposed"),
                        "type": "proposed",
                        "actor": "mission-control-local-agent-bridge",
                        "timestamp": timestamp,
                        "detail": format!("Hermes proposed \"{title}\" through the Mission Control bridge contract.")
                    }]
                }
            },
            {
                "type": "notification",
                "notification": {
                    "id": format!("notification-{command_id}"),
                    "level": if risk == "critical" { "critical" } else if risk == "elevated" { "warning" } else { "notice" },
                    "title": "Hermes proposal ready",
                    "body": format!("Command Inbox is holding \"{title}\" from Hermes."),
                    "source": "agent-bridge:hermes",
                    "timestamp": timestamp,
                    "acknowledged": false,
                    "relatedCommandId": command_id
                }
            }
        ]
    }))
}

fn handle_bridge_connection(
    mut stream: TcpStream,
    hermes_api_base_url: String,
    hermes_model: String,
    request_count: Arc<AtomicU64>,
    running: Arc<AtomicBool>,
    last_started_at: String,
) {
    let Ok((method, path, body)) = parse_http_request(&mut stream) else {
        send_json(&mut stream, "400 Bad Request", serde_json::json!({ "error": "Invalid request" }));
        return;
    };

    if method == "OPTIONS" {
        send_options(&mut stream);
        return;
    }

    if method == "GET" && path == "/status" {
        let payload = create_bridge_status(
            &hermes_api_base_url,
            &hermes_model,
            request_count.load(Ordering::SeqCst),
            &last_started_at,
        );
        send_json(&mut stream, "200 OK", payload);
        return;
    }

    if method == "GET" && path == "/sample-json" {
        send_json(
            &mut stream,
            "200 OK",
            serde_json::json!({
                "title": "Hermes bridge snapshot",
                "source": "mission-control-local-agent-bridge",
                "schemaHint": "metrics",
                "payload": {
                    "provider": "hermes",
                    "mission-controlBridge": LOCAL_AGENT_BRIDGE_URL,
                    "hermesApiBaseUrl": hermes_api_base_url,
                    "model": hermes_model,
                    "commandGate": "Command Inbox required",
                    "generatedAt": now_iso()
                }
            }),
        );
        return;
    }

    if method == "GET" && path == "/events" {
        let header = "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream; charset=utf-8\r\nCache-Control: no-cache, no-transform\r\nConnection: keep-alive\r\nAccess-Control-Allow-Origin: *\r\n\r\n";
        let _ = stream.write_all(header.as_bytes());
        while running.load(Ordering::SeqCst) {
            let payload = serde_json::json!({
                "type": "status",
                "status": create_bridge_status(&hermes_api_base_url, &hermes_model, request_count.load(Ordering::SeqCst), &last_started_at)
            });
            let line = format!("data: {}\n\n", serde_json::to_string(&payload).unwrap_or_else(|_| "{}".to_string()));
            if stream.write_all(line.as_bytes()).is_err() {
                break;
            }
            thread::sleep(Duration::from_secs(15));
        }
        return;
    }

    if method == "POST" && path == "/tasks" {
        request_count.fetch_add(1, Ordering::SeqCst);
        match serde_json::from_str::<serde_json::Value>(&body)
            .map_err(|error| error.to_string())
            .and_then(|request| create_task_result(request, &hermes_api_base_url, &hermes_model))
        {
            Ok(result) => send_json(&mut stream, "200 OK", result),
            Err(error) => send_json(
                &mut stream,
                "502 Bad Gateway",
                serde_json::json!({
                    "error": error,
                    "provider": "hermes",
                    "hermesApiBaseUrl": hermes_api_base_url
                }),
            ),
        }
        return;
    }

    send_json(
        &mut stream,
        "404 Not Found",
        serde_json::json!({
            "error": "Not found",
            "endpoints": ["/status", "/events", "/tasks", "/sample-json"]
        }),
    );
}

fn start_local_bridge_thread(hermes_api_base_url: String, hermes_model: String, running: Arc<AtomicBool>, last_started_at: String) -> Result<(), String> {
    let bind_addr: SocketAddr = LOCAL_AGENT_BRIDGE_BIND.parse::<SocketAddr>().map_err(|error| error.to_string())?;
    let listener = TcpListener::bind(bind_addr).map_err(|error| error.to_string())?;
    listener.set_nonblocking(true).map_err(|error| error.to_string())?;
    let request_count = Arc::new(AtomicU64::new(0));

    thread::spawn(move || {
        while running.load(Ordering::SeqCst) {
            match listener.accept() {
                Ok((stream, _)) => {
                    let base_url = hermes_api_base_url.clone();
                    let model = hermes_model.clone();
                    let counter = Arc::clone(&request_count);
                    let running_for_client = Arc::clone(&running);
                    let started_at = last_started_at.clone();
                    thread::spawn(move || {
                        handle_bridge_connection(stream, base_url, model, counter, running_for_client, started_at);
                    });
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(120));
                }
                Err(_) => {
                    thread::sleep(Duration::from_millis(250));
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn get_agent_bridge_status(manager: tauri::State<'_, LocalBridgeManager>) -> Result<LocalAgentBridgeProcessState, String> {
    let runtime = manager.runtime.lock().map_err(|error| error.to_string())?;
    Ok(process_state(&runtime))
}

#[tauri::command]
fn start_agent_bridge(
    manager: tauri::State<'_, LocalBridgeManager>,
    request: StartAgentBridgeRequest,
) -> Result<LocalAgentBridgeProcessState, String> {
    let mut runtime = manager.runtime.lock().map_err(|error| error.to_string())?;
    if runtime.running {
        runtime.hermes_api_base_url = normalize_hermes_api_base_url(&request.hermes_api_base_url);
        runtime.hermes_model = normalize_hermes_model(&request.hermes_model);
        return Ok(process_state(&runtime));
    }

    let hermes_api_base_url = normalize_hermes_api_base_url(&request.hermes_api_base_url);
    let hermes_model = normalize_hermes_model(&request.hermes_model);
    let running = Arc::new(AtomicBool::new(true));
    let started_at = now_iso();

    match start_local_bridge_thread(
        hermes_api_base_url.clone(),
        hermes_model.clone(),
        Arc::clone(&running),
        started_at.clone(),
    ) {
        Ok(()) => {
            runtime.running = true;
            runtime.stop_flag = Some(running);
            runtime.hermes_api_base_url = hermes_api_base_url;
            runtime.hermes_model = hermes_model;
            runtime.last_started_at = Some(started_at);
            runtime.last_error = None;
        }
        Err(error) => {
            runtime.running = false;
            runtime.stop_flag = None;
            runtime.last_error = Some(error.clone());
            return Err(error);
        }
    }

    Ok(process_state(&runtime))
}

#[tauri::command]
fn stop_agent_bridge(manager: tauri::State<'_, LocalBridgeManager>) -> Result<LocalAgentBridgeProcessState, String> {
    let mut runtime = manager.runtime.lock().map_err(|error| error.to_string())?;
    if let Some(stop_flag) = &runtime.stop_flag {
        stop_flag.store(false, Ordering::SeqCst);
        let _ = TcpStream::connect(LOCAL_AGENT_BRIDGE_BIND);
    }
    runtime.running = false;
    runtime.stop_flag = None;
    Ok(process_state(&runtime))
}

#[tauri::command]
fn restart_agent_bridge(
    manager: tauri::State<'_, LocalBridgeManager>,
    request: StartAgentBridgeRequest,
) -> Result<LocalAgentBridgeProcessState, String> {
    {
        let mut runtime = manager.runtime.lock().map_err(|error| error.to_string())?;
        if let Some(stop_flag) = &runtime.stop_flag {
            stop_flag.store(false, Ordering::SeqCst);
            let _ = TcpStream::connect(LOCAL_AGENT_BRIDGE_BIND);
        }
        runtime.running = false;
        runtime.stop_flag = None;
    }
    thread::sleep(Duration::from_millis(250));
    start_agent_bridge(manager, request)
}

pub fn run() {
    tauri::Builder::default()
        .manage(LocalBridgeManager::new())
        .setup(|app| {
            let main_window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Mission Control Center")
                .inner_size(1440.0, 960.0)
                .min_inner_size(1100.0, 720.0)
                .resizable(true)
                .center()
                .visible(true)
                .focused(true)
                .build()?;

            let _ = main_window.show();
            let _ = main_window.set_focus();

            Ok(())
        })
        .on_page_load(|webview, _payload| {
            if webview.label() == "main" {
                let _ = webview.show();
                let _ = webview.set_focus();
            }
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { .. } = event {
                    window.app_handle().exit(0);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            load_app_state,
            write_app_state,
            remove_app_state,
            start_agent_bridge,
            stop_agent_bridge,
            restart_agent_bridge,
            get_agent_bridge_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running Mission Control Center");
}
