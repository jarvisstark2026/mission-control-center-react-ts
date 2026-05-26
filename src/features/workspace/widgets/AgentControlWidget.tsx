import { useEffect, useState } from 'react';
import type { ShellRole } from '../../shell/roles';
import {
  canEditAgentSettings,
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
  getHermesApiBaseUrlForMode,
  getLocalAgentBridgeStatus,
  restartLocalAgentBridge,
  startLocalAgentBridge,
  stopLocalAgentBridge,
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
  type LocalAgentBridgeProcessState,
} from '../../agent-control';
import { createBridgeAgentTaskGateway, type AgentTaskGateway, type AgentTaskScope } from '../../agent-tasking';
import type { MissionControlRuntime } from '../../mission-control';
import { AgentAttribution, PermissionBadge } from '../operationalBlocks';
import {
  WorkspaceButton,
  WorkspaceContentHeader,
  WorkspaceContentShell,
  WorkspaceEmptyState,
  WorkspaceMetricGrid,
  WorkspaceSectionFrame,
  WorkspaceStatusStrip,
} from '../workspaceBlocks';
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
    placeholder: '192.0.2.64',
  },
  {
    id: 'tailscale',
    label: 'Tailscale',
    detail: 'Hermes is reached through a Tailscale address.',
    placeholder: '198.51.100.119',
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
}: {
  state: AgentControlState;
  role: ShellRole;
  missionControl: MissionControlRuntime;
  bridgeSettings: AgentBridgeSettings;
  onUpdateBridgeSettings: (settings: Partial<AgentBridgeSettings>) => void;
  onProbeBridge: () => Promise<AgentBridgeProbeResult[]>;
  onTestBridgeUrl: (url: string) => Promise<AgentBridgeProbeResult>;
  taskGateway: AgentTaskGateway;
}) {
  const initialBridgeMode = bridgeSettings.bridgeMode ?? 'same-pc';
  const [bridgeMode, setBridgeMode] = useState<AgentBridgeMode>(initialBridgeMode);
  const [hermesHost, setHermesHost] = useState(bridgeSettings.hermesHost ?? '');
  const [hermesApiPort, setHermesApiPort] = useState(bridgeSettings.hermesApiPort ?? '8642');
  const [hermesApiKey, setHermesApiKey] = useState(bridgeSettings.hermesApiKey ?? '');
  const [hermesModel, setHermesModel] = useState(bridgeSettings.hermesModel ?? 'hermes-agent');
  const [localBridgeUrl, setLocalBridgeUrl] = useState(bridgeSettings.localBridgeUrl);
  const [localBridgeProcess, setLocalBridgeProcess] = useState<LocalAgentBridgeProcessState | null>(null);
  const [bridgeSetupStatus, setBridgeSetupStatus] = useState('Choose where Hermes runs, then start the desktop local bridge.');
  const [bridgeInputWarning, setBridgeInputWarning] = useState('');
  const [activePanel, setActivePanel] = useState<AgentControlPanel>('connection');
  const [testProposalStatus, setTestProposalStatus] = useState('Send a safe test proposal when the bridge is connected.');

  useEffect(() => {
    setBridgeMode(bridgeSettings.bridgeMode ?? 'same-pc');
    setHermesHost(bridgeSettings.hermesHost ?? '');
    setHermesApiPort(bridgeSettings.hermesApiPort ?? '8642');
    setHermesApiKey(bridgeSettings.hermesApiKey ?? '');
    setHermesModel(bridgeSettings.hermesModel ?? 'hermes-agent');
    setLocalBridgeUrl(bridgeSettings.localBridgeUrl);
  }, [bridgeSettings.bridgeMode, bridgeSettings.hermesHost, bridgeSettings.hermesApiPort, bridgeSettings.hermesApiKey, bridgeSettings.hermesModel, bridgeSettings.localBridgeUrl]);

  const hermesApiBaseUrl = getHermesApiBaseUrlForMode(bridgeMode, hermesHost, hermesApiPort);

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
        <WorkspaceContentHeader
          eyebrow="Agent control"
          title="identity / jobs / permissions"
          metaEyebrow="access"
          meta="guest"
        />
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
  const visibleConnectors = connectors.filter((connector) => connector.id !== 'agent-remote-bridge');
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
  const groupedPermissions = (['read', 'suggest', 'execute', 'blocked'] as AgentPermissionLevel[])
    .map((level) => ({
      level,
      permissions: permissions.filter((permission) => permission.level === level),
    }))
    .filter((group) => group.permissions.length > 0);
  const saveBridgeSettings = () => {
    const savedHermesHost = bridgeMode === 'same-pc' ? '' : hermesHost;
    onUpdateBridgeSettings({
      bridgeMode,
      hermesHost: savedHermesHost,
      hermesApiPort,
      hermesApiKey,
      hermesApiBaseUrl,
      hermesModel,
      localBridgeUrl: 'http://127.0.0.1:8787',
      remoteApiUrl: '',
      preferredAgentId: selectedAgent.id,
    });
    setLocalBridgeUrl('http://127.0.0.1:8787');
    setBridgeSetupStatus('Bridge mode saved. Mission Control will use the local desktop bridge at http://127.0.0.1:8787.');
  };
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
    saveBridgeSettings();
    setBridgeSetupStatus('Starting local Mission Control bridge...');
    try {
      const processState = await startLocalAgentBridge({ hermesApiBaseUrl, hermesModel, hermesApiKey });
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
    saveBridgeSettings();
    setBridgeSetupStatus('Restarting local Mission Control bridge...');
    try {
      const processState = await restartLocalAgentBridge({ hermesApiBaseUrl, hermesModel, hermesApiKey });
      setLocalBridgeProcess(processState);
      onUpdateBridgeSettings({ localBridgeUrl: processState.bridgeUrl, lastSuccessfulUrl: processState.running ? processState.bridgeUrl : bridgeSettings.lastSuccessfulUrl });
      setBridgeSetupStatus(processState.running ? `Local bridge restarted at ${processState.bridgeUrl}.` : processState.lastError ?? 'Local bridge did not restart.');
    } catch (error) {
      setBridgeSetupStatus(error instanceof Error ? `Restart bridge failed: ${error.message}` : 'Restart bridge failed.');
    }
  };
  const restartBridgeAndProbe = async () => {
    saveBridgeSettings();
    setBridgeSetupStatus('Restarting local Mission Control bridge and probing /status...');
    try {
      const processState = await restartLocalAgentBridge({ hermesApiBaseUrl, hermesModel, hermesApiKey });
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
    saveBridgeSettings();
    setBridgeSetupStatus('Starting local bridge and testing the task proposal loop...');
    setTestProposalStatus('Starting bridge before diagnostic proposal...');
    try {
      const processState = await restartLocalAgentBridge({ hermesApiBaseUrl, hermesModel, hermesApiKey });
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
  const testHermesApi = async () => {
    setBridgeSetupStatus(`Testing Hermes API through ${hermesApiBaseUrl}...`);
    try {
      const processState = localBridgeProcess?.running
        ? await restartLocalAgentBridge({ hermesApiBaseUrl, hermesModel, hermesApiKey })
        : await startLocalAgentBridge({ hermesApiBaseUrl, hermesModel, hermesApiKey });
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
    setBridgeSetupStatus('Default agent saved for Agent Console.');
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
      <WorkspaceContentHeader
        eyebrow="Agent control"
        title="identity / jobs / permissions"
        metaEyebrow="connection"
        meta={`${activeConnector.kind} / ${activeConnector.status} / ${activeConnector.activeEngine ?? state.identity.model}`}
      />

      <WorkspaceStatusStrip
        source={taskGateway.mode === 'bridge' ? 'bridge' : 'local'}
        status={`${missionControlBridgeLabel} / ${hermesApiLabel}`}
        count={taskGatewayLabel}
        updatedAt={formatDateTime(state.lastBridgeEventAt)}
        action={{ label: 'Probe', onClick: probeBridgeNow, disabled: !editable }}
      />

      <WorkspaceSectionFrame
        className="mission-control-list-frame agent-control-cockpit"
        eyebrow="connection cockpit"
        title="live bridge state"
        meta={reachableUrl ? 'reachable' : activeConnector.status}
      >
        <WorkspaceMetricGrid
          className="mission-control-metrics agent-control-cockpit-metrics"
          metrics={[
            { label: 'provider', value: activeConnector.provider },
            { label: 'connector', value: activeConnector.kind },
            { label: 'status', value: activeConnector.status },
            { label: 'events', value: state.eventStreamStatus },
            { label: 'engine', value: activeConnector.activeEngine ?? state.identity.model, wide: true },
            { label: 'Mission Control bridge', value: missionControlBridgeLabel, wide: true },
            { label: 'Hermes API', value: `${hermesApiLabel} / ${hermesApiBaseUrl}`, wide: true },
            { label: 'Task loop', value: taskLoopStatus, wide: true },
            { label: 'Task gateway', value: taskGatewayLabel, wide: true },
            { label: 'mode', value: bridgeModeOptions.find((option) => option.id === bridgeMode)?.label ?? bridgeMode },
            { label: 'host / port', value: `${bridgeMode === 'same-pc' ? '127.0.0.1' : hermesHost || 'not set'}:${hermesApiPort || '8642'}`, wide: true },
            { label: 'API key', value: hermesApiKey ? 'configured' : 'not set' },
            { label: 'reachable', value: reachableUrl ?? 'waiting for /status', wide: true },
            { label: 'last success', value: bridgeSettings.lastSuccessfulUrl ?? 'not recorded', wide: true },
            { label: 'last event', value: formatDateTime(state.lastBridgeEventAt), wide: true },
          ]}
        />
        <div className="mission-control-actions agent-control-cockpit-actions">
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
        </div>
        <p className="mission-control-muted">{testProposalStatus}</p>
      </WorkspaceSectionFrame>

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
                setBridgeInputWarning(/^https:\/\//iu.test(nextHost.trim()) ? 'The bundled Mission Control bridge supports HTTP Hermes API endpoints only. Use an HTTP port, not HTTPS.' : '');
                setHermesHost(pastedPort ? getHostFromEndpointInput(nextHost) : nextHost);
                if (pastedPort) setHermesApiPort(pastedPort);
              }}
              placeholder={bridgeModeOptions.find((option) => option.id === bridgeMode)?.placeholder}
            />
          </label>
        ) : null}
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
          <span>Hermes API key</span>
          <input
            value={hermesApiKey}
            disabled={!editable}
            type="password"
            autoComplete="off"
            onChange={(event) => setHermesApiKey(event.currentTarget.value)}
            placeholder="optional bearer token"
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
        </div>
        {bridgeInputWarning ? <p className="mission-control-muted">{bridgeInputWarning}</p> : null}
        {localBridgeProcess?.lastError ? <p className="mission-control-muted">{localBridgeProcess.lastError}</p> : null}
        <div className="mission-control-actions agent-control-bridge-actions">
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
        <p className="mission-control-muted">{bridgeSetupStatus}</p>
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
