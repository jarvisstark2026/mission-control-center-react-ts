import type { AgentConnectorRecord } from '../../agent-control';
import type { AgentTaskGatewayMode } from '../../agent-tasking';
import type { MissionCommandGatewayMode } from '../../mission-control';

export type WorkflowDisplayState = 'ready' | 'fallback' | 'offline' | 'error';

export type WorkflowDisplay = {
  label: string;
  detail: string;
  meta: string;
  state: WorkflowDisplayState;
};

export function getAgentGatewayDisplay(
  gatewayMode: AgentTaskGatewayMode,
  connector: AgentConnectorRecord,
): WorkflowDisplay {
  if (gatewayMode === 'bridge' && connector.kind !== 'mock' && connector.status === 'connected') {
    return {
      label: 'Bridge proposal gateway',
      detail: `${connector.provider} can prepare proposals. Command Inbox still gates every executable action.`,
      meta: `${connector.provider} / ${connector.activeEngine ?? 'agent bridge'}`,
      state: 'ready',
    };
  }

  if (gatewayMode === 'backend') {
    return {
      label: 'Backend proposal gateway',
      detail: 'A configured proposal backend can prepare gated command requests for Command Inbox.',
      meta: connector.activeEngine ?? 'backend',
      state: connector.status === 'error' ? 'error' : 'ready',
    };
  }

  return {
    label: 'Local proposal fallback',
    detail: 'Mission Control can stage local proposal drafts while no live agent bridge is ready.',
    meta: connector.status === 'connected' ? connector.provider : connector.status,
    state: connector.status === 'error' ? 'error' : connector.status === 'offline' ? 'offline' : 'fallback',
  };
}

export function getCommandGatewayDisplay(gatewayMode: MissionCommandGatewayMode): WorkflowDisplay {
  if (gatewayMode === 'backend') {
    return {
      label: 'Backend command gateway',
      detail: 'Approved commands are forwarded to the configured command backend.',
      meta: 'live adapter',
      state: 'ready',
    };
  }
  if (gatewayMode === 'allowlist') {
    return {
      label: 'Allowlisted command gateway',
      detail: 'Approved commands run only through registered Mission Control adapters and role/risk checks.',
      meta: 'registered actions',
      state: 'ready',
    };
  }

  return {
    label: 'Local dry-run gateway',
    detail: 'Approvals are recorded and simulated locally. No external systems are changed.',
    meta: 'dry-run only',
    state: 'fallback',
  };
}
