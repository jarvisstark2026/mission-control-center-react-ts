use std::{collections::BTreeMap, fs, path::PathBuf};

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

type DesktopState = BTreeMap<String, String>;

const STATE_FILE_NAME: &str = "mission-control-state.json";

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

pub fn run() {
    tauri::Builder::default()
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
        .invoke_handler(tauri::generate_handler![
            load_app_state,
            write_app_state,
            remove_app_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running Mission Control Center");
}
