import { useEffect, useState } from 'react';
import type { ShellRole } from '../../shell/roles';
import { canEditAgentSettings,
  canViewAgentControl,
  createAgentPermissionChangeProposal,
  createAgentProfileChangeProposal,
  getActiveAgentConnector,
  getAgentBridgeReachableUrl,
  getAgentBridgeTutorialSteps,
  getAgentConnectors,
  getAgentJobSummary,
  getCommandAuditAgentActivity,
  getVisibleAgentDescriptors,
  getVisibleAgentActivity,
  getVisibleAgentJobs,
  getVisibleAgentPermissions,
  getAgentDescriptorById,
  getHermesApiBaseUrlForModeAndScheme,
  getLocalAgentBridgeStatus,
  hermesApiKeySecretRef,
  hermesVoiceApiKeySecretRef,
  isDesktopAgentSecretStoreAvailable,
  restartLocalAgentBridge,
  startLocalAgentBridge,
  stopLocalAgentBridge,
  writeAgentBridgeSecret,
  type AgentActivity,
  type AgentBridgeMode,
  type AgentBridgeProbeResult,
  type AgentBridgeSettings,
  type AgentBridgeDiagnostic,
  type AgentConnectorRecord,
  type AgentControlState,
  type AgentDescriptor,
  type AgentPermission,
  type AgentPermissionLevel,
  type AgentScheduledJob,
  type HermesApiScheme,
  type LocalAgentBridgeProcessState } from '../../agent-control';
import { createBridgeAgentTaskGateway, type AgentTaskGateway, type AgentTaskScope } from '../../agent-tasking';
import type { MissionControlRuntime } from '../../mission-control';
import { AgentAttribution, PermissionBadge } from '../operationalBlocks';
import { agentLiveLayoutPlacementLabels } from '../workspaceAgentLayout';
import { workspacePlacements, type WorkspacePlacement } from '../workspaceInstances';
import type { AgentLiveLayoutControlState, AgentLiveLayoutGlobalState } from '../workspaceAgentLayout';
import { WorkspaceButton,  WorkspaceContentShell,
  WorkspaceEmptyState,
  WorkspaceSectionFrame } from '../workspaceBlocks';
import { getAgentGatewayDisplay } from './agentWorkflowDisplay';

function formatDateTime(value: string | null) {
  if (!value) return 'not scheduled';
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return value;

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

function formatConnectorProvider(connector: AgentConnectorRecord) {
  const providerLabel: Record<AgentConnectorRecord['provider'], string> = {
    hermes: 'Hermes',
    openclaw: 'OpenClaw',
    openai: 'OpenAI',
    custom: 'Custom',
  };

  return providerLabel[connector.provider];
}

function AgentConnectorCard({
  connector,
  active,
}: {
  connector: AgentConnectorRecord;
  active: boolean;
}) {
  const checkedAt = connector.healthCheckedAt ?? connector.lastSeenAt;

  return (
    <article className="agent-control-connector-card" data-state={connector.status} data-active={active ? 'true' : 'false'}>
      <div className="agent-control-connector-head">
        <span>{connector.kind}</span>
        <strong>{formatConnectorProvider(connector)}</strong>
        <small>{connector.status}</small>
      </div>
      <p>{connector.url ?? 'No endpoint configured'}</p>
      <small>{connector.activeEngine ? `engine ${connector.activeEngine}` : `checked ${formatDateTime(checkedAt)}`}</small>
      <div className="agent-control-connector-capabilities">
        {connector.capabilities.slice(0, 3).map((capability) => (
          <span key={capability}>{capability}</span>
        ))}
      </div>
      {connector.error ? <small className="agent-control-connector-error">{connector.error}</small> : null}
    </article>
  );
}

function AgentJobCard({ job }: { job: AgentScheduledJob }) {
  return (
    <article className="mission-control-card agent-control-card" data-state={job.status}>
      <div className="mission-control-card-head">
        <div>
          <span>{job.kind} / {job.status}</span>
          <strong>{job.name}</strong>
        </div>
        <small>{job.cadence}</small>
      </div>
      <p>{job.description}</p>
      <div className="agent-control-card-meta">
        <span>last {formatDateTime(job.lastRunAt)}</span>
        <span>next {formatDateTime(job.nextRunAt)}</span>
      </div>
    </article>
  );
}

function AgentPermissionRow({
  permission,
  editable,
  onRequestChange,
}: {
  permission: AgentPermission;
  editable: boolean;
  onRequestChange: (permission: AgentPermission) => void;
}) {
  return (
    <div className="mission-control-row agent-control-permission-row" data-state={permission.level}>
      <span>{permission.label}</span>
      <strong><PermissionBadge level={permission.level} /></strong>
      <small>{editable ? 'editable' : `${permission.category} / ${permission.risk}`}</small>
      {editable ? (
        <WorkspaceButton variant="secondary" className="agent-control-inline-action" onClick={() => onRequestChange(permission)}>
          Request change
        </WorkspaceButton>
      ) : null}
    </div>
  );
}

function AgentActivityRow({ activity }: { activity: AgentActivity }) {
  return (
    <div className="mission-control-row agent-control-activity-row" data-state={activity.status ?? activity.kind}>
      <span>{activity.title}</span>
      <strong>{activity.kind}</strong>
      <small>{formatDateTime(activity.timestamp)}</small>
    </div>
  );
}

function AgentDiagnosticRow({ diagnostic }: { diagnostic: AgentBridgeDiagnostic }) {
  return (
    <div className="mission-control-row agent-control-diagnostic-row" data-state={diagnostic.level}>
      <span>{diagnostic.source} / {diagnostic.level}</span>
      <strong>{diagnostic.message}</strong>
      <small>{formatDateTime(diagnostic.timestamp)}</small>
      {diagnostic.payloadSummary ? <p>{diagnostic.payloadSummary}</p> : null}
    </div>
  );
}

const bridgeCommandSnippets = [
  {
    label: 'Desktop local bridge',
    command: 'Use Start bridge in the Mission Control desktop app.',
  },
  {
    label: 'Same PC Hermes API',
    command: 'http://127.0.0.1:<port>/v1',
  },
  {
    label: 'LAN Hermes API',
    command: 'http://<lan-ip>:<port>/v1',
  },
  {
    label: 'Tailscale Hermes API',
    command: 'http://<tailscale-ip>:<port>/v1',
  },
];

const bridgeModeOptions: Array<{ id: AgentBridgeMode; label: string; detail: string; placeholder: string }> = [
  {
    id: 'same-pc',
    label: 'Same PC',
    detail: 'Hermes runs on this Windows desktop.',
    placeholder: '127.0.0.1',
  },
  {
    id: 'lan',
    label: 'LAN PC',
    detail: 'Hermes runs on another machine in the local network.',
    placeholder: '192.168.1.20',
  },
  {
    id: 'tailscale',
    label: 'Tailscale',
    detail: 'Hermes is reached through a Tailscale address.',
    placeholder: '100.64.0.10',
  },
];

type AgentControlPanel = 'connection' | 'agents' | 'permissions' | 'diagnostics' | 'help';

const agentControlPanels: Array<{ id: AgentControlPanel; label: string }> = [
  { id: 'connection', label: 'Connection' },
  { id: 'agents', label: 'Agents' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'diagnostics', label: 'Diagnostics' },
  { id: 'help', label: 'Help' },
];

function getStatusUrl(url: string | null | undefined) {
  const trimmedUrl = url?.trim().replace(/\/+$/u, '');
  return trimmedUrl ? `${trimmedUrl}/status` : null;
}

async function postBridgeJson(baseUrl: string, path: string, payload: unknown) {
  const response = await fetch(`${baseUrl.replace(/\/+$/u, '')}${path}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const raw = await response.text();
  let body: unknown = {};
  try {
    body = raw.trim() ? JSON.parse(raw) : {};
  } catch {
    body = raw;
  }
  if (!response.ok) {
    const record = body && typeof body === 'object' ? body as Record<string, unknown> : {};
    const errorCode = typeof record.errorCode === 'string' ? `${record.errorCode}: ` : '';
    const error = typeof record.error === 'string' ? record.error : `${response.status} ${response.statusText}`.trim();
    throw new Error(`${errorCode}${error}`.trim());
  }
  return body;
}

function getPortFromEndpointInput(value: string) {
  const hostPort = value
    .trim()
    .replace(/^https?:\/\//u, '')
    .replace(/\/.*$/u, '');
  const portMatch = hostPort.match(/:(\d{1,5})$/u);
  return portMatch?.[1];
}

function getHostFromEndpointInput(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//u, '')
    .replace(/\/.*$/u, '')
    .replace(/:\d{1,5}$/u, '');
}

function getProbeSummary(result: AgentBridgeProbeResult) {
  if (result.ok) {
    const provider = result.provider ? `${result.provider} ` : '';
    if (result.status === 'connected') {
      return `${provider}${result.activeEngine ?? 'bridge'} ready at ${result.url}.`;
    }
    if (result.status === 'offline') {
      return `Mission Control bridge is reachable at ${result.url}, but Hermes is offline or unreachable.`;
    }
    if (result.status === 'error') {
      return `Mission Control bridge is reachable at ${result.url}, but it reported an error.`;
    }
    return `${provider}${result.activeEngine ?? 'bridge'} reachable at ${result.url}.`;
  }

  return `${result.url || 'Bridge'} unreachable: ${result.error ?? 'fetch failed'}`;
}

function getTestTaskScope(role: ShellRole): AgentTaskScope {
  if (role === 'home') return 'household';
  if (role === 'support') return 'support';
  return 'system';
}

function getTaskLoopStatusLabel({
  bridgeStoppedOrUnknown,
  latestTaskFailure,
  taskGatewayMode,
  localConnectorStatus,
  activityCount,
}: {
  bridgeStoppedOrUnknown: boolean;
  latestTaskFailure?: AgentBridgeDiagnostic;
  taskGatewayMode: AgentTaskGateway['mode'];
  localConnectorStatus?: string;
  activityCount: number;
}) {
  if (bridgeStoppedOrUnknown) return 'not tested';
  if (latestTaskFailure) {
    if (/401|403|auth|api key/iu.test(latestTaskFailure.message)) return 'auth failed';
    if (/unsupported|invalid json|non-json|schema/iu.test(latestTaskFailure.message)) return 'unsupported response';
    if (/offline|refused|timed out|timeout|failed/iu.test(latestTaskFailure.message)) return 'offline';
    return 'failing';
  }
  if (taskGatewayMode === 'bridge' && localConnectorStatus === 'connected' && activityCount > 0) return 'ready';
  return 'not tested';
}

function AgentRegistryCard({
  agent,
  selected,
  editable,
  onSelect,
}: {
  agent: AgentDescriptor;
  selected: boolean;
  editable: boolean;
  onSelect: (agentId: string) => void;
}) {
  return (
    <article className="mission-control-card agent-control-card agent-control-agent-card" role="listitem" data-state={agent.connection} data-selected={selected ? 'true' : 'false'}>
      <div className="mission-control-card-head">
        <AgentAttribution agent={agent} profile={`${agent.provider} / ${agent.model}`} />
        <small>{selected ? 'default' : agent.connection}</small>
      </div>
      <p>{agent.summary}</p>
      <div className="agent-control-card-meta">
        <span>{agent.specialty}</span>
        <span>{agent.profile}</span>
        <span>{agent.visibleTo.join(' / ')}</span>
      </div>
      {editable ? (
        <WorkspaceButton variant="secondary" className="agent-control-inline-action" onClick={() => onSelect(agent.id)}>
          Use by default
        </WorkspaceButton>
      ) : null}
    </article>
  );
}

export function AgentControlWidget({
  state,
  role,
  missionControl,
  bridgeSettings,
  onUpdateBridgeSettings,
  onProbeBridge,
  onTestBridgeUrl,
  taskGateway,
  liveLayout,
  liveLayoutGlobal,
  onSetLiveLayoutEnabled,
  onSetAllLiveLayoutEnabled,
  onPauseAllLiveLayout,
}: {
  state: AgentControlState;
  role: ShellRole;
  missionControl: MissionControlRuntime;
  bridgeSettings: AgentBridgeSettings;
  onUpdateBridgeSettings: (settings: Partial<AgentBridgeSettings>) => void;
  onProbeBridge: () => Promise<AgentBridgeProbeResult[]>;
  onTestBridgeUrl: (url: string) => Promise<AgentBridgeProbeResult>;
  taskGateway: AgentTaskGateway;
  liveLayout: AgentLiveLayoutControlState;
  liveLayoutGlobal: AgentLiveLayoutGlobalState;
  onSetLiveLayoutEnabled: (placement: WorkspacePlacement, enabled: boolean) => void;
  onSetAllLiveLayoutEnabled: (enabled: boolean) => void;
  onPauseAllLiveLayout: () => void;
}) {
  const initialBridgeMode = bridgeSettings.bridgeMode ?? 'same-pc';
  const [bridgeMode, setBridgeMode] = useState<AgentBridgeMode>(initialBridgeMode);
  const [hermesHost, setHermesHost] = useState(bridgeSettings.hermesHost ?? '');
  const [hermesApiScheme, setHermesApiScheme] = useState<HermesApiScheme>(bridgeSettings.hermesApiScheme ?? 'http');
  const [hermesApiPort, setHermesApiPort] = useState(bridgeSettings.hermesApiPort ?? '8642');
  const [hermesApiKey, setHermesApiKey] = useState(bridgeSettings.hermesApiKey ?? '');
  const [hasSavedHermesApiKey, setHasSavedHermesApiKey] = useState(Boolean(bridgeSettings.hasHermesApiKey));
  const [hermesModel, setHermesModel] = useState(bridgeSettings.hermesModel ?? 'hermes-agent');
  const [voiceTranscriptionUrl, setVoiceTranscriptionUrl] = useState(bridgeSettings.voiceTranscriptionUrl ?? '');
  const [voiceTranscriptionModel, setVoiceTranscriptionModel] = useState(bridgeSettings.voiceTranscriptionModel ?? '');
  const [voiceTranscriptionApiKey, setVoiceTranscriptionApiKey] = useState(bridgeSettings.voiceTranscriptionApiKey ?? '');
  const [hasSavedVoiceTranscriptionApiKey, setHasSavedVoiceTranscriptionApiKey] = useState(Boolean(bridgeSettings.hasVoiceTranscriptionApiKey));
  const [localBridgeUrl, setLocalBridgeUrl] = useState(bridgeSettings.localBridgeUrl);
  const [localBridgeProcess, setLocalBridgeProcess] = useState<LocalAgentBridgeProcessState | null>(null);
  const [bridgeSetupStatus, setBridgeSetupStatus] = useState('Choose where Hermes runs, then start the desktop local bridge.');
  const [bridgeInputWarning, setBridgeInputWarning] = useState('');
  const [activePanel, setActivePanel] = useState<AgentControlPanel>('connection');
  const [testProposalStatus, setTestProposalStatus] = useState('Send a safe test proposal when the bridge is connected.');

  useEffect(() => {
    setBridgeMode(bridgeSettings.bridgeMode ?? 'same-pc');
    setHermesHost(bridgeSettings.hermesHost ?? '');
    setHermesApiScheme(bridgeSettings.hermesApiScheme ?? 'http');
    setHermesApiPort(bridgeSettings.hermesApiPort ?? '8642');
    setHermesApiKey(bridgeSettings.hermesApiKey ?? '');
    setHasSavedHermesApiKey(Boolean(bridgeSettings.hasHermesApiKey));
    setHermesModel(bridgeSettings.hermesModel ?? 'hermes-agent');
    setVoiceTranscriptionUrl(bridgeSettings.voiceTranscriptionUrl ?? '');
    setVoiceTranscriptionModel(bridgeSettings.voiceTranscriptionModel ?? '');
    setVoiceTranscriptionApiKey(bridgeSettings.voiceTranscriptionApiKey ?? '');
    setHasSavedVoiceTranscriptionApiKey(Boolean(bridgeSettings.hasVoiceTranscriptionApiKey));
    setLocalBridgeUrl(bridgeSettings.localBridgeUrl);
  }, [bridgeSettings.bridgeMode, bridgeSettings.hermesHost, bridgeSettings.hermesApiScheme, bridgeSettings.hermesApiPort, bridgeSettings.hermesApiKey, bridgeSettings.hasHermesApiKey, bridgeSettings.hermesModel, bridgeSettings.voiceTranscriptionUrl, bridgeSettings.voiceTranscriptionModel, bridgeSettings.voiceTranscriptionApiKey, bridgeSettings.hasVoiceTranscriptionApiKey, bridgeSettings.localBridgeUrl]);

  const hermesApiBaseUrl = getHermesApiBaseUrlForModeAndScheme(bridgeMode, hermesHost, hermesApiPort, hermesApiScheme);

  useEffect(() => {
    let cancelled = false;
    void getLocalAgentBridgeStatus(hermesApiBaseUrl).then((processState) => {
      if (!cancelled) setLocalBridgeProcess(processState);
    });
    return () => {
      cancelled = true;
    };
  }, [hermesApiBaseUrl]);

  if (!canViewAgentControl(role)) {
    return (
      <WorkspaceContentShell className="mission-control-surface agent-control-surface">
        <WorkspaceEmptyState source="unavailable" title="No access for this scope" detail="Agent identity, scheduled jobs, and permission details are hidden from guest access." />
      </WorkspaceContentShell>
    );
  }

  const jobs = getVisibleAgentJobs(state, role);
  const agents = getVisibleAgentDescriptors(state, role);
  const permissions = getVisibleAgentPermissions(state, role);
  const activity = [
    ...getCommandAuditAgentActivity(missionControl.state.commands, role),
    ...getVisibleAgentActivity(state, role),
  ].sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
  const summary = getAgentJobSummary(jobs);
  const editable = canEditAgentSettings(role);
  const connectors = getAgentConnectors(state);
  const visibleConnectors = connectors.filter((connector) => connector.id !== 'agent-remote-bridge' && connector.kind !== 'mock');
  const visibleConnectorCount = visibleConnectors.filter((connector) => connector.status !== 'not-configured').length;
  const activeConnector = getActiveAgentConnector(state);
  const gatewayDisplay = getAgentGatewayDisplay(taskGateway.mode, activeConnector);
  const localHermesConnector = connectors.find((connector) => connector.id === 'hermes-local-bridge');
  const bridgeTutorialSteps = getAgentBridgeTutorialSteps(state, bridgeSettings);
  const reachableUrl = getAgentBridgeReachableUrl(state);
  const selectedAgent = agents.find((agent) => agent.id === bridgeSettings.preferredAgentId) ?? agents.find((agent) => agent.id === state.activeAgentId) ?? agents[0] ?? getAgentDescriptorById(state, state.activeAgentId);
  const preferredStatusUrl = getStatusUrl(reachableUrl ?? bridgeSettings.lastSuccessfulUrl ?? localBridgeUrl);
  const localBridgeChecked = Boolean(localHermesConnector?.healthCheckedAt || localHermesConnector?.lastSeenAt);
  const localBridgeReachable = Boolean(localHermesConnector?.url && localBridgeChecked && !localHermesConnector.error);
  const latestTaskFailure = state.diagnostics.find((diagnostic) => diagnostic.source === 'tasks' && diagnostic.level !== 'info');
  const bridgeStoppedOrUnknown = !localBridgeReachable && !localBridgeProcess?.running;
  const taskLoopStatus = getTaskLoopStatusLabel({
    bridgeStoppedOrUnknown,
    latestTaskFailure,
    taskGatewayMode: taskGateway.mode,
    localConnectorStatus: localHermesConnector?.status,
    activityCount: state.activity.filter((item) => item.kind === 'proposal' || item.source.includes('task')).length,
  });
  const hasAuthFailure = /401|403|auth|api key/iu.test(`${localHermesConnector?.error ?? ''} ${latestTaskFailure?.message ?? ''}`);
  const missionControlBridgeLabel = localBridgeProcess?.running
    ? 'running'
    : localBridgeReachable
      ? 'reachable'
      : localBridgeProcess?.available === false
        ? 'desktop controls unavailable'
        : localHermesConnector?.error
          ? 'unreachable'
          : 'Mission Control bridge stopped';
  let hermesApiLabel = 'not checked';
  if (!bridgeStoppedOrUnknown) {
    if (hasAuthFailure) {
      hermesApiLabel = 'auth failed';
    } else if (localHermesConnector?.status === 'connected') {
      hermesApiLabel = 'connected';
    } else if (localHermesConnector?.status === 'offline') {
      hermesApiLabel = 'offline';
    } else if (localHermesConnector?.status === 'error') {
      hermesApiLabel = 'error';
    }
  }
  let taskGatewayLabel = 'Local proposal fallback';
  if (!bridgeStoppedOrUnknown && latestTaskFailure) {
    taskGatewayLabel = `Task loop failing / ${latestTaskFailure.message}`;
  } else if (!bridgeStoppedOrUnknown && localHermesConnector?.status === 'connected' && taskGateway.mode === 'bridge') {
    taskGatewayLabel = gatewayDisplay.label;
  }
  const bridgeProcessLabel = localBridgeProcess?.available === false
    ? localBridgeReachable
      ? 'browser preview / bridge reachable'
      : 'desktop app required'
    : localBridgeProcess?.running
      ? `running${localBridgeProcess.pid ? ` / pid ${localBridgeProcess.pid}` : ''}`
      : 'stopped';
  const liveLayoutWorkspaces = workspacePlacements.map((placement) => liveLayoutGlobal.workspaces[placement]);
  const liveLayoutEnabledCount = liveLayoutWorkspaces.filter((workspace) => workspace.enabled).length;
  const liveLayoutMovingCount = liveLayoutWorkspaces.reduce((count, workspace) => count + workspace.activeWidgetIds.length, 0);
  const liveLayoutErrorCount = liveLayoutWorkspaces.filter((workspace) => Boolean(workspace.lastError)).length;
  const liveLayoutSummary =
    liveLayoutMovingCount > 0
      ? `moving ${liveLayoutMovingCount} widget${liveLayoutMovingCount === 1 ? '' : 's'}`
      : liveLayoutEnabledCount > 0
        ? `${liveLayoutEnabledCount} workspace${liveLayoutEnabledCount === 1 ? '' : 's'} listening`
        : liveLayoutErrorCount > 0
          ? `${liveLayoutErrorCount} workspace${liveLayoutErrorCount === 1 ? '' : 's'} need attention`
          : 'off';
  const groupedPermissions = (['read', 'suggest', 'execute', 'blocked'] as AgentPermissionLevel[])
    .map((level) => ({
      level,
      permissions: permissions.filter((permission) => permission.level === level),
    }))
    .filter((group) => group.permissions.length > 0);
  const saveBridgeSettings = async () => {
    const savedHermesHost = bridgeMode === 'same-pc' ? '' : hermesHost;
    const keyInput = hermesApiKey.trim();
    let hermesApiKeyRef = bridgeSettings.hermesApiKeyRef;
    let rawHermesApiKey = bridgeSettings.hermesApiKey;
    let keyPresent = Boolean(bridgeSettings.hasHermesApiKey);
    const voiceKeyInput = voiceTranscriptionApiKey.trim();
    let voiceTranscriptionApiKeyRef = bridgeSettings.voiceTranscriptionApiKeyRef;
    let rawVoiceTranscriptionApiKey = bridgeSettings.voiceTranscriptionApiKey;
    let voiceKeyPresent = Boolean(bridgeSettings.hasVoiceTranscriptionApiKey);
    if (keyInput) {
      const secretResult = await writeAgentBridgeSecret(keyInput, hermesApiKeySecretRef);
      if (secretResult.available) {
        hermesApiKeyRef = secretResult.keyRef;
        rawHermesApiKey = undefined;
        keyPresent = true;
        setHermesApiKey('');
        setHasSavedHermesApiKey(true);
      } else {
        rawHermesApiKey = keyInput;
        keyPresent = true;
        setHasSavedHermesApiKey(true);
      }
    }
    if (voiceKeyInput) {
      const secretResult = await writeAgentBridgeSecret(voiceKeyInput, hermesVoiceApiKeySecretRef);
      if (secretResult.available) {
        voiceTranscriptionApiKeyRef = secretResult.keyRef;
        rawVoiceTranscriptionApiKey = undefined;
        voiceKeyPresent = true;
        setVoiceTranscriptionApiKey('');
        setHasSavedVoiceTranscriptionApiKey(true);
      } else {
        rawVoiceTranscriptionApiKey = voiceKeyInput;
        voiceKeyPresent = true;
        setHasSavedVoiceTranscriptionApiKey(true);
      }
    }
    onUpdateBridgeSettings({
      bridgeMode,
      hermesHost: savedHermesHost,
      hermesApiScheme,
      hermesApiPort,
      hermesApiKey: rawHermesApiKey,
      hermesApiKeyRef,
      hasHermesApiKey: keyPresent,
      hermesApiBaseUrl,
      hermesModel,
      voiceTranscriptionUrl: voiceTranscriptionUrl.trim(),
      voiceTranscriptionModel: voiceTranscriptionModel.trim(),
      voiceTranscriptionApiKey: rawVoiceTranscriptionApiKey,
      voiceTranscriptionApiKeyRef,
      hasVoiceTranscriptionApiKey: voiceKeyPresent,
      voiceTranscriptionTimeoutMs: bridgeSettings.voiceTranscriptionTimeoutMs ?? 20000,
      voiceTranscriptionMimeTypes: bridgeSettings.voiceTranscriptionMimeTypes,
      localBridgeUrl: 'http://127.0.0.1:8787',
      remoteApiUrl: '',
      preferredAgentId: selectedAgent.id,
    });
    setLocalBridgeUrl('http://127.0.0.1:8787');
    setBridgeSetupStatus(
      keyInput && isDesktopAgentSecretStoreAvailable()
        ? 'Bridge mode saved. Hermes API key moved to the desktop credential store.'
        : keyInput
          ? 'Bridge mode saved. Browser preview stores the API key locally; use the installed app for desktop credential storage.'
          : 'Bridge mode saved. Mission Control will use the local desktop bridge at http://127.0.0.1:8787.',
    );
    return {
      hermesApiKey: rawHermesApiKey,
      hermesApiKeyRef,
      voiceTranscriptionApiKey: rawVoiceTranscriptionApiKey,
      voiceTranscriptionApiKeyRef,
    };
  };
  const getBridgeStartInput = (secret: {
    hermesApiKey?: string;
    hermesApiKeyRef?: string;
    voiceTranscriptionApiKey?: string;
    voiceTranscriptionApiKeyRef?: string;
  } = {}) => ({
    hermesApiBaseUrl,
    hermesModel,
    hermesApiKey: secret.hermesApiKey ?? (hermesApiKey.trim() || bridgeSettings.hermesApiKey),
    hermesApiKeyRef: secret.hermesApiKeyRef ?? bridgeSettings.hermesApiKeyRef,
    voiceTranscriptionUrl: voiceTranscriptionUrl.trim() || bridgeSettings.voiceTranscriptionUrl,
    voiceTranscriptionModel: voiceTranscriptionModel.trim() || bridgeSettings.voiceTranscriptionModel,
    voiceTranscriptionApiKey: secret.voiceTranscriptionApiKey ?? (voiceTranscriptionApiKey.trim() || bridgeSettings.voiceTranscriptionApiKey),
    voiceTranscriptionApiKeyRef: secret.voiceTranscriptionApiKeyRef ?? bridgeSettings.voiceTranscriptionApiKeyRef,
    voiceTranscriptionTimeoutMs: bridgeSettings.voiceTranscriptionTimeoutMs ?? 20000,
    voiceTranscriptionMimeTypes: bridgeSettings.voiceTranscriptionMimeTypes,
  });
  const probeBridgeNow = async () => {
    setBridgeSetupStatus('Probing configured bridge endpoints...');
    const results = await onProbeBridge();
    const successfulResult = results.find((result) => result.ok);
    if (successfulResult) {
      onUpdateBridgeSettings({ lastSuccessfulUrl: successfulResult.url });
      setBridgeSetupStatus(getProbeSummary(successfulResult));
      return;
    }
    setBridgeSetupStatus(results[0] ? getProbeSummary(results[0]) : 'No configured bridge endpoints to probe.');
  };
  const refreshLocalBridgeProcess = async () => {
    const processState = await getLocalAgentBridgeStatus(hermesApiBaseUrl);
    setLocalBridgeProcess(processState);
    return processState;
  };
  const startDesktopBridge = async () => {
    const secret = await saveBridgeSettings();
    setBridgeSetupStatus('Starting local Mission Control bridge...');
    try {
      const processState = await startLocalAgentBridge(getBridgeStartInput(secret));
      setLocalBridgeProcess(processState);
      onUpdateBridgeSettings({ localBridgeUrl: processState.bridgeUrl, lastSuccessfulUrl: processState.running ? processState.bridgeUrl : bridgeSettings.lastSuccessfulUrl });
      setBridgeSetupStatus(processState.running ? `Local bridge running at ${processState.bridgeUrl}.` : processState.lastError ?? 'Local bridge did not start.');
    } catch (error) {
      setBridgeSetupStatus(error instanceof Error ? `Start bridge failed: ${error.message}` : 'Start bridge failed.');
    }
  };
  const stopDesktopBridge = async () => {
    setBridgeSetupStatus('Stopping local Mission Control bridge...');
    const processState = await stopLocalAgentBridge(hermesApiBaseUrl);
    setLocalBridgeProcess(processState);
    setBridgeSetupStatus(!processState.available ? processState.lastError ?? 'Desktop app required to stop the bundled bridge.' : processState.running ? 'Local bridge is still running.' : 'Local bridge stopped.');
  };
  const restartDesktopBridge = async () => {
    const secret = await saveBridgeSettings();
    setBridgeSetupStatus('Restarting local Mission Control bridge...');
    try {
      const processState = await restartLocalAgentBridge(getBridgeStartInput(secret));
      setLocalBridgeProcess(processState);
      onUpdateBridgeSettings({ localBridgeUrl: processState.bridgeUrl, lastSuccessfulUrl: processState.running ? processState.bridgeUrl : bridgeSettings.lastSuccessfulUrl });
      setBridgeSetupStatus(processState.running ? `Local bridge restarted at ${processState.bridgeUrl}.` : processState.lastError ?? 'Local bridge did not restart.');
    } catch (error) {
      setBridgeSetupStatus(error instanceof Error ? `Restart bridge failed: ${error.message}` : 'Restart bridge failed.');
    }
  };
  const restartBridgeAndProbe = async () => {
    const secret = await saveBridgeSettings();
    setBridgeSetupStatus('Restarting local Mission Control bridge and probing /status...');
    try {
      const processState = await restartLocalAgentBridge(getBridgeStartInput(secret));
      setLocalBridgeProcess(processState);
      onUpdateBridgeSettings({
        localBridgeUrl: processState.bridgeUrl,
        lastSuccessfulUrl: processState.running ? processState.bridgeUrl : bridgeSettings.lastSuccessfulUrl,
      });
      if (!processState.available) {
        setBridgeSetupStatus(processState.lastError ?? 'Desktop app required to restart the bundled bridge.');
        return;
      }
      if (!processState.running) {
        setBridgeSetupStatus(processState.lastError ?? 'Local bridge is stopped; /status was not probed.');
        return;
      }
      const result = await onTestBridgeUrl(processState.bridgeUrl);
      setBridgeSetupStatus(`Restarted local bridge. ${getProbeSummary(result)}`);
      if (result.ok) {
        onUpdateBridgeSettings({ localBridgeUrl: processState.bridgeUrl, lastSuccessfulUrl: processState.bridgeUrl });
      }
    } catch (error) {
      setBridgeSetupStatus(error instanceof Error ? `Restart and probe failed: ${error.message}` : 'Restart and probe failed.');
    }
  };
  const startBridgeAndTestTaskLoop = async () => {
    const secret = await saveBridgeSettings();
    setBridgeSetupStatus('Starting local bridge and testing the task proposal loop...');
    setTestProposalStatus('Starting bridge before diagnostic proposal...');
    try {
      const processState = await restartLocalAgentBridge(getBridgeStartInput(secret));
      setLocalBridgeProcess(processState);
      onUpdateBridgeSettings({
        localBridgeUrl: processState.bridgeUrl,
        lastSuccessfulUrl: processState.running ? processState.bridgeUrl : bridgeSettings.lastSuccessfulUrl,
      });
      if (!processState.available) {
        const message = processState.lastError ?? 'Desktop app required to start the bundled bridge.';
        setBridgeSetupStatus(message);
        setTestProposalStatus(message);
        return;
      }
      if (!processState.running) {
        const message = processState.lastError ?? 'Local bridge did not start.';
        setBridgeSetupStatus(message);
        setTestProposalStatus(message);
        return;
      }

      const probeResult = await onTestBridgeUrl(processState.bridgeUrl);
      setBridgeSetupStatus(`Local bridge restarted. ${getProbeSummary(probeResult)}`);
      if (!probeResult.ok) {
        setTestProposalStatus(probeResult.error ?? 'Task loop not tested because /status failed.');
        return;
      }

      const timestamp = new Date().toISOString();
      const directGateway = createBridgeAgentTaskGateway(processState.bridgeUrl);
      const result = await directGateway.submitTask({
        id: `agent-control-loop-${Date.parse(timestamp).toString(36)}`,
        objective: 'Verify the Mission Control local bridge can create a safe Command Inbox proposal.',
        scope: getTestTaskScope(role),
        risk: 'safe',
        role,
        targetAgentId: selectedAgent.id,
        source: 'agent-control',
        requestedAt: timestamp,
      });
      missionControl.ingestEvents(result.missionControlEvents);
      setTestProposalStatus(`Task loop ready. ${result.proposals.length || 1} diagnostic proposal sent to Command Inbox.`);
    } catch (error) {
      setTestProposalStatus(error instanceof Error ? `Task loop failed: ${error.message}` : 'Task loop failed.');
    }
  };
  const runLiveValidation = async () => {
    const secret = await saveBridgeSettings();
    setBridgeSetupStatus('Running live Hermes validation across status, chat, voice, tasks, and layout...');
    setTestProposalStatus('Live validation started.');
    try {
      const processState = await restartLocalAgentBridge(getBridgeStartInput(secret));
      setLocalBridgeProcess(processState);
      onUpdateBridgeSettings({
        localBridgeUrl: processState.bridgeUrl,
        lastSuccessfulUrl: processState.running ? processState.bridgeUrl : bridgeSettings.lastSuccessfulUrl,
      });
      if (!processState.available || !processState.running) {
        const message = processState.lastError ?? 'Local bridge is unavailable.';
        setBridgeSetupStatus(message);
        setTestProposalStatus(message);
        return;
      }

      const statusResult = await onTestBridgeUrl(processState.bridgeUrl);
      if (!statusResult.ok) {
        const message = statusResult.error ?? 'Bridge /status failed.';
        setBridgeSetupStatus(message);
        setTestProposalStatus(message);
        return;
      }

      await postBridgeJson(processState.bridgeUrl, '/chat', {
        message: 'Live validation: reply with a short Mission Control status check and no direct actions.',
        source: 'agent-control-validation',
      });

      let voiceSummary = 'voice not configured';
      if (voiceTranscriptionUrl.trim()) {
        await postBridgeJson(processState.bridgeUrl, '/voice/transcribe', {
          audioBase64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
          mimeType: 'audio/wav',
          recordedAt: new Date().toISOString(),
        });
        voiceSummary = 'voice endpoint responded';
      }

      const timestamp = new Date().toISOString();
      const directGateway = createBridgeAgentTaskGateway(processState.bridgeUrl);
      const result = await directGateway.submitTask({
        id: `agent-control-live-validation-${Date.parse(timestamp).toString(36)}`,
        objective: 'Live validation: create one safe Mission Control proposal for Command Inbox.',
        scope: getTestTaskScope(role),
        risk: 'safe',
        role,
        targetAgentId: selectedAgent.id,
        source: 'agent-control',
        requestedAt: timestamp,
      });
      missionControl.ingestEvents(result.missionControlEvents);

      await postBridgeJson(processState.bridgeUrl, '/workspace/layout/plan', {
        workspaceId: 'agent-control-validation',
        canvas: { width: 800, height: 600 },
        widgets: [],
        locks: { agentAnimatingWidgetIds: [] },
      });

      setBridgeSetupStatus(`Live validation passed: /status, /chat, /tasks, and layout ready; ${voiceSummary}.`);
      setTestProposalStatus(`${result.proposals.length || 1} validation proposal sent to Command Inbox.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Live validation failed.';
      setBridgeSetupStatus(`Live validation failed: ${message}`);
      setTestProposalStatus(`Live validation failed: ${message}`);
    }
  };
  const testHermesApi = async () => {
    setBridgeSetupStatus(`Testing Hermes API through ${hermesApiBaseUrl}...`);
    try {
      const processState = localBridgeProcess?.running
        ? await restartLocalAgentBridge(getBridgeStartInput())
        : await startLocalAgentBridge(getBridgeStartInput());
      setLocalBridgeProcess(processState);
      if (!processState.available) {
        setBridgeSetupStatus(processState.lastError ?? 'Desktop app required to test Hermes through the bundled bridge.');
        return;
      }
      if (!processState.running) {
        setBridgeSetupStatus(processState.lastError ?? 'Local bridge is stopped.');
        return;
      }
      const result = await onTestBridgeUrl(processState.bridgeUrl);
      setBridgeSetupStatus(`Hermes API via local bridge: ${getProbeSummary(result)}`);
      if (result.ok) {
        onUpdateBridgeSettings({ localBridgeUrl: processState.bridgeUrl, lastSuccessfulUrl: processState.bridgeUrl });
      }
    } catch (error) {
      setBridgeSetupStatus(error instanceof Error ? `Hermes API test failed: ${error.message}` : 'Hermes API test failed.');
    }
  };
  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setBridgeSetupStatus(`${label} copied.`);
    } catch {
      setBridgeSetupStatus(`${label}: ${text}`);
    }
  };
  const selectPreferredAgent = (agentId: string) => {
    onUpdateBridgeSettings({ preferredAgentId: agentId });
    setBridgeSetupStatus('Default agent saved for Agent proposals.');
  };
  const requestPermissionChange = (permission: AgentPermission) => {
    missionControl.ingestEvents(createAgentPermissionChangeProposal(selectedAgent, permission));
    setTestProposalStatus(`Permission review for ${permission.label} sent to Command Inbox.`);
  };
  const requestProfileReview = () => {
    missionControl.ingestEvents(createAgentProfileChangeProposal(selectedAgent));
    setTestProposalStatus(`Profile review for ${selectedAgent.name} sent to Command Inbox.`);
  };
  const sendTestProposal = async () => {
    setTestProposalStatus('Sending test task through active bridge...');
    try {
      const timestamp = new Date().toISOString();
      const result = await taskGateway.submitTask({
        id: `agent-control-test-${Date.parse(timestamp).toString(36)}`,
        objective: 'Verify the Mission Control agent bridge by staging a safe diagnostic proposal.',
        scope: getTestTaskScope(role),
        risk: 'safe',
        role,
        targetAgentId: selectedAgent.id,
        source: 'agent-control',
        requestedAt: timestamp,
      });
      missionControl.ingestEvents(result.missionControlEvents);
      setTestProposalStatus(`${result.proposals.length || 1} test proposal sent to Command Inbox.`);
    } catch (error) {
      setTestProposalStatus(error instanceof Error ? `Test proposal failed: ${error.message}` : 'Test proposal failed.');
    }
  };

  return (
    <WorkspaceContentShell className="mission-control-surface agent-control-surface">
      <section className="agent-control-health-strip" aria-label="Agent bridge health">
        <div data-state={localBridgeReachable || localBridgeProcess?.running ? 'ready' : 'offline'}>
          <span>Mission Control bridge</span>
          <strong>{missionControlBridgeLabel}</strong>
          <small>{reachableUrl ?? '127.0.0.1:8787'}</small>
        </div>
        <div data-state={hermesApiLabel === 'connected' ? 'ready' : hermesApiLabel === 'auth failed' || hermesApiLabel === 'error' ? 'failed' : 'pending'}>
          <span>Hermes API</span>
          <strong>{hermesApiLabel}</strong>
          <small>{hermesApiBaseUrl || 'not configured'}</small>
        </div>
        <div data-state={taskGateway.mode === 'bridge' ? 'ready' : 'pending'}>
          <span>Task gateway</span>
          <strong>{taskGatewayLabel}</strong>
          <small>{taskLoopStatus}</small>
        </div>
        <div data-state={state.lastBridgeEventAt ? 'ready' : 'pending'}>
          <span>Last event</span>
          <strong>{formatDateTime(state.lastBridgeEventAt)}</strong>
          <small>{state.eventStreamStatus}</small>
        </div>
        <div data-state={liveLayoutMovingCount || liveLayoutEnabledCount ? 'ready' : liveLayoutErrorCount ? 'failed' : 'pending'}>
          <span>Live layout</span>
          <strong>{liveLayoutSummary}</strong>
          <small>{liveLayout.enabled ? `${agentLiveLayoutPlacementLabels[liveLayout.placement]} active` : 'workspace toggles'}</small>
        </div>
      </section>

      <div className="agent-control-section-tabs" role="tablist" aria-label="Agent Control sections">
        {agentControlPanels.map((panel) => (
          <button
            key={panel.id}
            type="button"
            className="agent-control-section-tab"
            aria-selected={activePanel === panel.id}
            aria-pressed={activePanel === panel.id}
            onClick={() => setActivePanel(panel.id)}
          >
            {panel.label}
          </button>
        ))}
      </div>

      {activePanel === 'connection' ? (
        <>
      <WorkspaceSectionFrame
        className="mission-control-list-frame agent-control-connectors-frame"
        eyebrow="agent bridge"
        title="Hermes / OpenClaw connectors"
        meta={`${visibleConnectorCount}/${visibleConnectors.length} visible`}
      >
        <p className="agent-control-connector-note">
          Mission Control talks to the local desktop bridge at http://127.0.0.1:8787. That bridge then connects to Hermes from one of three modes: same PC, LAN PC, or Tailscale.
        </p>
        <div className="agent-control-connector-grid" role="list" aria-label="Agent connectors">
          {visibleConnectors.map((connector) => (
            <AgentConnectorCard key={connector.id} connector={connector} active={connector.id === activeConnector.id} />
          ))}
        </div>
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame
        className="mission-control-list-frame agent-control-bridge-setup"
        eyebrow="bridge setup"
        title="Hermes connection mode"
        meta={editable ? 'admin editable' : 'view only'}
      >
        <p className="agent-control-connector-note">
          Pick where Hermes runs. The desktop app starts a local Mission Control bridge on 127.0.0.1:8787, then forwards tasks to the Hermes API previewed below.
        </p>
        <div className="agent-control-mode-grid" role="radiogroup" aria-label="Hermes connection mode">
          {bridgeModeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className="agent-control-mode-card"
              data-selected={bridgeMode === option.id ? 'true' : 'false'}
              role="radio"
              aria-checked={bridgeMode === option.id}
              disabled={!editable}
              onClick={() => {
                setBridgeMode(option.id);
                if (option.id === 'same-pc') setHermesHost('');
              }}
            >
              <span>{option.label}</span>
              <strong>{option.detail}</strong>
            </button>
          ))}
        </div>
        {bridgeMode !== 'same-pc' ? (
          <label className="agent-control-bridge-field">
            <span>{bridgeMode === 'lan' ? 'LAN host or IP' : 'Tailscale host or IP'}</span>
            <input
              value={hermesHost}
              disabled={!editable}
              onChange={(event) => {
                const nextHost = event.currentTarget.value;
                const pastedPort = getPortFromEndpointInput(nextHost);
                if (/^https:\/\//iu.test(nextHost.trim())) setHermesApiScheme('https');
                if (/^http:\/\//iu.test(nextHost.trim())) setHermesApiScheme('http');
                setBridgeInputWarning(/^https:\/\//iu.test(nextHost.trim()) ? 'HTTPS is supported with normal certificate validation. Self-signed or invalid certificates will fail.' : '');
                setHermesHost(pastedPort ? getHostFromEndpointInput(nextHost) : nextHost);
                if (pastedPort) setHermesApiPort(pastedPort);
              }}
              placeholder={bridgeModeOptions.find((option) => option.id === bridgeMode)?.placeholder}
            />
          </label>
        ) : null}
        <label className="agent-control-bridge-field">
          <span>Hermes API scheme</span>
          <select value={hermesApiScheme} disabled={!editable} onChange={(event) => setHermesApiScheme(event.currentTarget.value as HermesApiScheme)}>
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
          </select>
        </label>
        <label className="agent-control-bridge-field">
          <span>Hermes API port</span>
          <input
            value={hermesApiPort}
            disabled={!editable}
            inputMode="numeric"
            onChange={(event) => setHermesApiPort(event.currentTarget.value)}
            placeholder="8642"
          />
        </label>
        <label className="agent-control-bridge-field">
          <span>Hermes model</span>
          <input
            value={hermesModel}
            disabled={!editable}
            onChange={(event) => setHermesModel(event.currentTarget.value)}
            placeholder="hermes-agent"
          />
        </label>
        <label className="agent-control-bridge-field">
          <span>Hermes API key{hasSavedHermesApiKey ? ' saved' : ''}</span>
          <input
            value={hermesApiKey}
            disabled={!editable}
            type="password"
            autoComplete="off"
            onChange={(event) => setHermesApiKey(event.currentTarget.value)}
            placeholder={hasSavedHermesApiKey ? 'saved in desktop credential store' : 'optional bearer token'}
          />
        </label>
        <label className="agent-control-bridge-field">
          <span>Voice transcription URL</span>
          <input
            value={voiceTranscriptionUrl}
            disabled={!editable}
            onChange={(event) => setVoiceTranscriptionUrl(event.currentTarget.value)}
            placeholder="optional bridge-backed transcription endpoint"
          />
        </label>
        <label className="agent-control-bridge-field">
          <span>Voice model</span>
          <input
            value={voiceTranscriptionModel}
            disabled={!editable}
            onChange={(event) => setVoiceTranscriptionModel(event.currentTarget.value)}
            placeholder="optional transcription model"
          />
        </label>
        <label className="agent-control-bridge-field">
          <span>Voice API key{hasSavedVoiceTranscriptionApiKey ? ' saved' : ''}</span>
          <input
            value={voiceTranscriptionApiKey}
            disabled={!editable}
            type="password"
            autoComplete="off"
            onChange={(event) => setVoiceTranscriptionApiKey(event.currentTarget.value)}
            placeholder={hasSavedVoiceTranscriptionApiKey ? 'saved in desktop credential store' : 'optional bearer token'}
          />
        </label>
        <div className="agent-control-bridge-status-grid">
          <div>
            <span>Mission Control bridge</span>
            <strong>{localBridgeProcess?.bridgeUrl ?? 'http://127.0.0.1:8787'}</strong>
          </div>
          <div>
            <span>process</span>
            <strong>{bridgeProcessLabel}</strong>
          </div>
          <div>
            <span>Hermes API</span>
            <strong>{hermesApiBaseUrl || 'enter host'}</strong>
          </div>
          <div>
            <span>saved endpoint</span>
            <strong>{bridgeSettings.localBridgeUrl || 'not saved'}</strong>
          </div>
          <div>
            <span>Hermes live layout</span>
            <strong>{liveLayoutSummary}</strong>
          </div>
          <div>
            <span>moving widgets</span>
            <strong>{liveLayoutMovingCount ? String(liveLayoutMovingCount) : 'none'}</strong>
          </div>
        </div>
        <div className="agent-control-bridge-status-grid" aria-label="Hermes endpoint readiness">
          <div>
            <span>/status</span>
            <strong>{localBridgeReachable || localBridgeProcess?.running ? 'reachable' : 'not reachable'}</strong>
          </div>
          <div>
            <span>/chat</span>
            <strong>{localHermesConnector?.status === 'connected' && localHermesConnector.capabilities.includes('chat') ? 'ready' : hermesApiLabel}</strong>
          </div>
          <div>
            <span>/voice/transcribe</span>
            <strong>{voiceTranscriptionUrl.trim() ? (localHermesConnector?.capabilities.includes('voice-transcription') ? 'configured' : 'not tested') : 'not configured'}</strong>
          </div>
          <div>
            <span>/tasks</span>
            <strong>{taskLoopStatus}</strong>
          </div>
          <div>
            <span>/workspace/layout/plan</span>
            <strong>{localHermesConnector?.capabilities.includes('workspace-layout-control') ? liveLayoutSummary : 'not tested'}</strong>
          </div>
        </div>
        {bridgeInputWarning ? <p className="mission-control-muted">{bridgeInputWarning}</p> : null}
        {localBridgeProcess?.lastError ? <p className="mission-control-muted">{localBridgeProcess.lastError}</p> : null}
        <div className="mission-control-actions agent-control-bridge-actions">
          <WorkspaceButton variant="secondary" disabled={!editable} onClick={probeBridgeNow}>
            Probe now
          </WorkspaceButton>
          <WorkspaceButton variant="secondary" disabled={!preferredStatusUrl} onClick={() => preferredStatusUrl && window.open(preferredStatusUrl, '_blank', 'noopener,noreferrer')}>
            Open /status
          </WorkspaceButton>
          <WorkspaceButton variant="secondary" disabled={!reachableUrl && !bridgeSettings.lastSuccessfulUrl} onClick={() => copyText('Bridge URL', reachableUrl ?? bridgeSettings.lastSuccessfulUrl ?? '')}>
            Copy URL
          </WorkspaceButton>
          <WorkspaceButton variant="primary" disabled={!editable} onClick={sendTestProposal}>
            Send test proposal
          </WorkspaceButton>
          <WorkspaceButton variant="secondary" disabled={!editable} onClick={startBridgeAndTestTaskLoop}>
            Start bridge and test task loop
          </WorkspaceButton>
          <WorkspaceButton variant="primary" disabled={!editable || !hermesApiBaseUrl} onClick={runLiveValidation}>
            Run live Hermes validation
          </WorkspaceButton>
          <WorkspaceButton
            variant="secondary"
            aria-expanded={false}
            onClick={() => setActivePanel('help')}
          >
            Bridge help
          </WorkspaceButton>
          <WorkspaceButton variant="secondary" disabled={!editable} onClick={saveBridgeSettings}>
            Save settings
          </WorkspaceButton>
          <WorkspaceButton variant="secondary" disabled={!editable || !hermesApiBaseUrl} onClick={startDesktopBridge}>
            Start bridge
          </WorkspaceButton>
          <WorkspaceButton variant="secondary" disabled={!editable} onClick={stopDesktopBridge}>
            Stop bridge
          </WorkspaceButton>
          <WorkspaceButton variant="secondary" disabled={!editable || !hermesApiBaseUrl} onClick={restartDesktopBridge}>
            Restart bridge
          </WorkspaceButton>
          <WorkspaceButton variant="primary" disabled={!editable || !hermesApiBaseUrl} onClick={restartBridgeAndProbe}>
            Restart bridge and probe
          </WorkspaceButton>
          <WorkspaceButton variant="secondary" disabled={!editable || !hermesApiBaseUrl} onClick={testHermesApi}>
            Test Hermes API
          </WorkspaceButton>
          <WorkspaceButton variant="secondary" onClick={() => void refreshLocalBridgeProcess()}>
            Refresh state
          </WorkspaceButton>
        </div>
        <p className="mission-control-muted">{testProposalStatus}</p>
        <p className="mission-control-muted">{bridgeSetupStatus}</p>
        <div className="agent-control-live-layout-panel">
          <div>
            <span>Live layout by workspace</span>
            <strong>{liveLayoutSummary}</strong>
            <small>
              Mouse drag wins in each workspace. Layout changes stay session-only until Save Layout.
            </small>
          </div>
          <div className="agent-control-live-layout-actions">
            <WorkspaceButton variant="secondary" disabled={!editable} onClick={() => onSetAllLiveLayoutEnabled(true)}>
              Enable all
            </WorkspaceButton>
            <WorkspaceButton variant="secondary" disabled={!editable} onClick={onPauseAllLiveLayout}>
              Pause all
            </WorkspaceButton>
            <WorkspaceButton variant="secondary" disabled={!editable} onClick={() => onSetAllLiveLayoutEnabled(false)}>
              Stop all
            </WorkspaceButton>
          </div>
        </div>
        <div className="agent-control-live-layout-grid" role="group" aria-label="Hermes live layout workspace toggles">
          {workspacePlacements.map((placement) => {
            const workspaceState = liveLayoutGlobal.workspaces[placement];
            const movingCount = workspaceState.activeWidgetIds.length;
            return (
              <button
                key={placement}
                type="button"
                className="agent-control-live-layout-tile"
                data-state={workspaceState.enabled ? workspaceState.status : workspaceState.status === 'paused by user' ? 'paused by user' : 'off'}
                aria-pressed={workspaceState.enabled}
                disabled={!editable}
                onClick={() => onSetLiveLayoutEnabled(placement, !workspaceState.enabled)}
              >
                <span>{agentLiveLayoutPlacementLabels[placement]}</span>
                <strong>{workspaceState.enabled ? workspaceState.status : workspaceState.status === 'paused by user' ? 'paused' : 'off'}</strong>
                <small>
                  {movingCount ? `${movingCount} moving` : workspaceState.lastError ? workspaceState.lastError : workspaceState.workspaceId}
                </small>
              </button>
            );
          })}
        </div>
      </WorkspaceSectionFrame>
        </>
      ) : null}

      {activePanel === 'help' ? (
        <WorkspaceSectionFrame
          className="mission-control-list-frame agent-control-bridge-tutorial"
          eyebrow="bridge help"
          title="connect an AI agent"
          meta={reachableUrl ? 'connected' : 'setup guide'}
        >
          <p className="agent-control-connector-note">
            The installed desktop app owns the Mission Control bridge. Users only choose Same PC, LAN PC, or Tailscale, then test that Hermes can create a gated proposal.
          </p>
          <div className="agent-control-bridge-status-grid">
            <div>
              <span>mode</span>
              <strong>{bridgeModeOptions.find((option) => option.id === bridgeMode)?.label ?? bridgeMode}</strong>
            </div>
            <div>
              <span>Hermes API</span>
              <strong>{hermesApiBaseUrl || 'enter host'}</strong>
            </div>
            <div>
              <span>reachable</span>
              <strong>{reachableUrl ?? 'waiting for /status'}</strong>
            </div>
          </div>
          <div className="agent-control-tutorial-steps" role="list" aria-label="Agent bridge tutorial checklist">
            {bridgeTutorialSteps.map((step) => (
              <article className="agent-control-tutorial-step" data-state={step.status} key={step.id} role="listitem">
                <div>
                  <span>{step.status}</span>
                  <strong>{step.title}</strong>
                </div>
                <p>{step.body}</p>
                {editable && step.command ? (
                  <div className="agent-control-command-line">
                    <code>{step.command}</code>
                    <WorkspaceButton variant="secondary" className="agent-control-inline-action" onClick={() => copyText(step.title, step.command ?? '')}>
                      Copy
                    </WorkspaceButton>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
          {editable ? (
            <div className="agent-control-command-snippets" aria-label="Copy-ready bridge commands">
              {bridgeCommandSnippets.map((snippet) => (
                <div className="agent-control-command-snippet" key={snippet.label}>
                  <span>{snippet.label}</span>
                  <div className="agent-control-command-line">
                    <code>{snippet.command}</code>
                    <WorkspaceButton variant="secondary" className="agent-control-inline-action" onClick={() => copyText(snippet.label, snippet.command)}>
                      Copy
                    </WorkspaceButton>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mission-control-muted">Ask an admin to start the bridge, save the endpoint, and run the verifier.</p>
          )}
        </WorkspaceSectionFrame>
      ) : null}

      {activePanel === 'diagnostics' ? (
        <>
      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="bridge diagnostics"
        title="connection and payload checks"
        meta={`${state.diagnostics.length} records`}
      >
        <div className="mission-control-compact-list" role="list" aria-label="Agent bridge diagnostics">
          {state.diagnostics.slice(0, 6).map((diagnostic) => (
            <AgentDiagnosticRow key={diagnostic.id} diagnostic={diagnostic} />
          ))}
        </div>
      </WorkspaceSectionFrame>
      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="recent activity"
        title="audit timeline"
        meta={`${activity.length} records`}
      >
        <div className="mission-control-compact-list" role="list" aria-label="Agent activity timeline">
          {activity.slice(0, 6).map((item) => (
            <AgentActivityRow key={item.id} activity={item} />
          ))}
        </div>
      </WorkspaceSectionFrame>
        </>
      ) : null}

      {activePanel === 'agents' ? (
        <>
      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="active model"
        title={`${selectedAgent.name} / ${selectedAgent.profile}`}
        meta={editable ? 'admin editable' : 'view only'}
      >
        <div className="agent-control-profile-panel">
          <div>
            <span>default agent</span>
            <strong>{selectedAgent.name}</strong>
          </div>
          <div>
            <span>runtime profile</span>
            <strong>{selectedAgent.provider} / {selectedAgent.model}</strong>
          </div>
          {editable ? (
            <WorkspaceButton
              variant="secondary"
              className="agent-control-edit-button"
              onClick={requestProfileReview}
            >
              Request profile review
            </WorkspaceButton>
          ) : null}
        </div>
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="agent registry"
        title="available agents"
        meta={`${agents.length} visible`}
      >
        <div className="mission-control-card-list" role="list" aria-label="Agent registry">
          {agents.map((agent) => (
            <AgentRegistryCard
              key={agent.id}
              agent={agent}
              selected={agent.id === selectedAgent.id}
              editable={editable}
              onSelect={selectPreferredAgent}
            />
          ))}
        </div>
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="cron / automation"
        title="scheduled work"
        meta={`${summary.failed} failed`}
      >
        <div className="mission-control-card-list" role="list" aria-label="Agent scheduled work">
          {jobs.map((job) => (
            <AgentJobCard key={job.id} job={job} />
          ))}
        </div>
      </WorkspaceSectionFrame>
        </>
      ) : null}

      {activePanel === 'permissions' ? (
      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="tool permissions"
        title="agent gates"
        meta={editable ? 'editable' : 'locked'}
      >
        <div className="agent-control-permission-groups" role="list" aria-label="Agent tool permissions">
          {groupedPermissions.map((group) => (
            <section className="agent-control-permission-group" key={group.level} aria-label={`${group.level} permissions`}>
              <h4>{group.level}</h4>
              <div className="mission-control-compact-list">
                {group.permissions.map((permission) => (
                  <AgentPermissionRow key={permission.id} permission={permission} editable={editable} onRequestChange={requestPermissionChange} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </WorkspaceSectionFrame>
      ) : null}
    </WorkspaceContentShell>
  );
}
