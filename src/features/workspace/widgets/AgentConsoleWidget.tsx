import { useEffect, useMemo, useState } from 'react';

import {
  canSubmitAgentTask,
  canViewAgentConsole,
  getAgentTaskScopesForRole,
  useAgentTasking,
  type AgentTaskGateway,
  type AgentTaskScope,
} from '../../agent-tasking';
import { getActiveAgentConnector, getAgentDescriptorById, getVisibleAgentDescriptors, type AgentBridgeSettings, type AgentControlState } from '../../agent-control';
import type { CommandRisk, MissionControlRuntime } from '../../mission-control';
import type { OperationalOsRuntime } from '../../operational-os';
import type { ShellRole } from '../../shell/roles';
import { AgentAttribution, AttentionCard, EvidenceBlock, StatusSummary } from '../operationalBlocks';
import {
  WorkspaceButton,
  WorkspaceContentHeader,
  WorkspaceContentShell,
  WorkspaceSectionFrame,
  WorkspaceSummaryPanel,
} from '../workspaceBlocks';
import { getAgentGatewayDisplay } from './agentWorkflowDisplay';

const scopeLabels: Record<AgentTaskScope, string> = {
  household: 'Household',
  system: 'System',
  support: 'Support',
  security: 'Security',
};

const riskLabels: Record<CommandRisk, string> = {
  safe: 'Safe',
  elevated: 'Elevated',
  critical: 'Critical',
};

function getDefaultObjective(role: ShellRole) {
  if (role === 'support') return 'Check the media and network status, then propose a safe diagnostic action.';
  if (role === 'home') return 'Prepare the evening home routine and explain what will happen before approval.';
  return 'Review current mission state and propose the next useful action.';
}

function getDefaultScope(role: ShellRole): AgentTaskScope {
  return getAgentTaskScopesForRole(role)[0] ?? 'household';
}

function getDefaultRisk(role: ShellRole): CommandRisk {
  return role === 'admin' ? 'elevated' : 'safe';
}

function formatTime(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return value;

  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

export function AgentConsoleWidget({
  role,
  missionControl,
  agentControl,
  taskGateway,
  operationalOs,
  bridgeSettings,
  onOpenCommandInbox,
}: {
  role: ShellRole;
  missionControl: MissionControlRuntime;
  agentControl: AgentControlState;
  taskGateway?: AgentTaskGateway;
  operationalOs: OperationalOsRuntime;
  bridgeSettings: AgentBridgeSettings;
  onOpenCommandInbox?: (commandId?: string) => void;
}) {
  const tasking = useAgentTasking(role, missionControl.ingestEvents, taskGateway);
  const availableScopes = useMemo(() => getAgentTaskScopesForRole(role), [role]);
  const visibleAgents = useMemo(() => getVisibleAgentDescriptors(agentControl, role), [agentControl, role]);
  const preferredAgent = visibleAgents.find((agent) => agent.id === bridgeSettings.preferredAgentId);
  const defaultAgent = preferredAgent ?? visibleAgents.find((agent) => agent.specialty === 'coordinator') ?? visibleAgents[0] ?? getAgentDescriptorById(agentControl, agentControl.activeAgentId);
  const [objective, setObjective] = useState(() => getDefaultObjective(role));
  const [scope, setScope] = useState<AgentTaskScope>(() => getDefaultScope(role));
  const [risk, setRisk] = useState<CommandRisk>(() => getDefaultRisk(role));
  const [targetAgentId, setTargetAgentId] = useState(defaultAgent.id);
  const [goalId, setGoalId] = useState('');
  const targetAgent = getAgentDescriptorById(agentControl, targetAgentId);
  const selectedGoal = operationalOs.state.goals.find((goal) => goal.id === goalId) ?? null;
  const activeConnector = getActiveAgentConnector(agentControl);
  const canView = canViewAgentConsole(role);
  const canSubmit = canSubmitAgentTask(role, { scope, risk });
  const canRetryLastRequest = tasking.state.lastRequest ? canSubmitAgentTask(role, tasking.state.lastRequest) : false;
  const gatewayDisplay = getAgentGatewayDisplay(tasking.gatewayMode, activeConnector);
  const primarySubmitLabel = gatewayDisplay.state === 'ready' ? 'Ask agent' : 'Stage local proposal';
  const commandById = new Map(missionControl.state.commands.map((command) => [command.id, command]));
  const proposalByCommandId = new Map(tasking.state.proposals.map((proposal) => [proposal.commandId, proposal]));

  useEffect(() => {
    if (preferredAgent) {
      setTargetAgentId(preferredAgent.id);
    }
  }, [preferredAgent]);

  if (!canView) {
    return (
      <WorkspaceContentShell className="mission-control-surface agent-console-surface">
        <WorkspaceContentHeader
          eyebrow="Agent console"
          title="tasking / proposals"
          metaEyebrow="access"
          meta="guest"
        />
        <WorkspaceSummaryPanel title="No access for this scope">
          Guest access can review allowed workspace surfaces, but agent tasking is disabled.
        </WorkspaceSummaryPanel>
      </WorkspaceContentShell>
    );
  }

  const submitTask = () => {
    void tasking.submitTask(objective, scope, risk, targetAgent.id, {
      goalId: selectedGoal?.id,
      evidenceIds: selectedGoal?.evidenceIds,
      source: 'agent-console',
    });
  };
  const retryLastRequest = () => {
    const request = tasking.state.lastRequest;
    if (!request) return;
    setObjective(request.objective);
    setScope(request.scope);
    setRisk(request.risk);
    setTargetAgentId(request.targetAgentId);
    setGoalId(request.goalId ?? '');
    void tasking.submitTask(request.objective, request.scope, request.risk, request.targetAgentId, {
      goalId: request.goalId,
      evidenceIds: request.evidenceIds,
      workflowRunId: request.workflowRunId,
      workflowStepId: request.workflowStepId,
      source: request.source ?? 'agent-console',
    });
  };
  const retryRequest = (request: NonNullable<typeof tasking.state.lastRequest>) => {
    setObjective(request.objective);
    setScope(request.scope);
    setRisk(request.risk);
    setTargetAgentId(request.targetAgentId);
    setGoalId(request.goalId ?? '');
    void tasking.submitTask(request.objective, request.scope, request.risk, request.targetAgentId, {
      goalId: request.goalId,
      evidenceIds: request.evidenceIds,
      workflowRunId: request.workflowRunId,
      workflowStepId: request.workflowStepId,
      source: request.source ?? 'agent-console',
    });
  };

  return (
    <WorkspaceContentShell className="mission-control-surface agent-console-surface">
      <WorkspaceContentHeader
        eyebrow="Agent console"
        title="chat / proposals"
        metaEyebrow="gateway"
        meta={gatewayDisplay.label}
      />

      <StatusSummary
        label="Gateway status"
        title={gatewayDisplay.label}
        detail={gatewayDisplay.detail}
        meta={`${tasking.state.status} / ${gatewayDisplay.meta}`}
      />

      <WorkspaceSectionFrame
        className="mission-control-list-frame agent-console-compose"
        eyebrow="conversation"
        title="operator thread"
        meta={tasking.state.status}
      >
        <div className="agent-console-gateway-strip" data-state={gatewayDisplay.state}>
          <span>{gatewayDisplay.label}</span>
          <strong>{activeConnector.provider} / {activeConnector.status}</strong>
          <small>{gatewayDisplay.detail}</small>
        </div>
        <AttentionCard label="Selected agent" title={targetAgent.name} risk={risk}>
          <AgentAttribution agent={targetAgent} profile={targetAgent.profile} />
          <p>{targetAgent.summary}</p>
        </AttentionCard>
        <div className="agent-console-context-grid">
          <label className="agent-console-field">
            <span>goal</span>
            <select value={goalId} onChange={(event) => setGoalId(event.currentTarget.value)} aria-label="Related goal">
              <option value="">No goal link</option>
              {operationalOs.state.goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}
                </option>
              ))}
            </select>
          </label>
          <label className="agent-console-field">
            <span>target agent</span>
            <select value={targetAgentId} onChange={(event) => setTargetAgentId(event.currentTarget.value)} aria-label="Target agent">
              {visibleAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>
          <div className="agent-console-context-pill">
            <span>evidence</span>
            <strong>{selectedGoal?.evidenceIds.length ?? 0}</strong>
          </div>
        </div>
        {selectedGoal ? (
          <EvidenceBlock label="goal context" title={selectedGoal.title}>
            {selectedGoal.objective} Evidence linked: {selectedGoal.evidenceIds.length}.
          </EvidenceBlock>
        ) : null}
        <label className="agent-console-field">
          <span>message / task</span>
          <textarea
            value={objective}
            rows={4}
            onChange={(event) => setObjective(event.currentTarget.value)}
            aria-label="Agent message or task"
          />
        </label>
        <div className="agent-console-selector-row" role="group" aria-label="Agent task scope">
          {availableScopes.map((item) => (
            <button
              key={item}
              type="button"
              className="agent-console-chip"
              aria-pressed={scope === item}
              onClick={() => setScope(item)}
            >
              {scopeLabels[item]}
            </button>
          ))}
        </div>
        <div className="agent-console-selector-row" role="group" aria-label="Agent task risk">
          {(['safe', 'elevated', 'critical'] as CommandRisk[]).map((item) => (
            <button
              key={item}
              type="button"
              className="agent-console-chip"
              aria-pressed={risk === item}
              onClick={() => setRisk(item)}
            >
              {riskLabels[item]}
            </button>
          ))}
        </div>
        <div className="mission-control-actions">
          <WorkspaceButton
            variant="primary"
            className="agent-console-submit"
            disabled={!canSubmit || tasking.state.status === 'drafting'}
            onClick={submitTask}
          >
            {primarySubmitLabel}
          </WorkspaceButton>
          {tasking.state.status === 'failed' && tasking.state.lastRequest ? (
            <WorkspaceButton
              variant="secondary"
              className="agent-console-submit"
              disabled={!canRetryLastRequest}
              onClick={retryLastRequest}
            >
              Retry last request
            </WorkspaceButton>
          ) : null}
        </div>
        {!canSubmit ? <p className="mission-control-muted">This role cannot submit that scope/risk combination.</p> : null}
        {tasking.state.error ? <p className="mission-control-muted">Last error: {tasking.state.error}</p> : null}
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="conversation"
        title="thread and command cards"
        meta={`${tasking.state.messages.length} messages`}
      >
        <div className="mission-control-compact-list" role="list" aria-label="Agent console conversation">
          {tasking.state.messages.slice(0, 7).map((message) => (
            <div className="mission-control-row" key={message.id} role="listitem" data-state={message.author}>
              <span>{message.author}</span>
              <strong>{message.status ?? formatTime(message.timestamp)}</strong>
              <EvidenceBlock label="message">{message.body}</EvidenceBlock>
              {message.commandId && (proposalByCommandId.has(message.commandId) || commandById.has(message.commandId)) ? (
                <div className="agent-console-command-card" data-state={commandById.get(message.commandId)?.status ?? 'pending'}>
                  <span>Command Inbox card</span>
                  <strong>{proposalByCommandId.get(message.commandId)?.title ?? commandById.get(message.commandId)?.title}</strong>
                  <small>
                    ID {message.commandId} / {proposalByCommandId.get(message.commandId)?.scope ?? commandById.get(message.commandId)?.scope} / {proposalByCommandId.get(message.commandId)?.risk ?? commandById.get(message.commandId)?.risk} / {commandById.get(message.commandId)?.status ?? 'pending'}
                  </small>
                  <p>{proposalByCommandId.get(message.commandId)?.reasoning ?? commandById.get(message.commandId)?.reasoning}</p>
                  {onOpenCommandInbox ? (
                    <WorkspaceButton variant="compact" onClick={() => onOpenCommandInbox(message.commandId)}>
                      Open Command Inbox
                    </WorkspaceButton>
                  ) : null}
                </div>
              ) : null}
              {message.status === 'failed' && message.retryRequest && canSubmitAgentTask(role, message.retryRequest) ? (
                <div className="mission-control-actions">
                  <WorkspaceButton variant="secondary" onClick={() => retryRequest(message.retryRequest!)}>
                    Retry this request
                  </WorkspaceButton>
                </div>
              ) : null}
              {message.goalId || message.workflowRunId || message.commandId ? (
                <small>
                  {message.goalId ? `Goal ${message.goalId}` : ''}
                  {message.workflowRunId ? ` / Run ${message.workflowRunId}` : ''}
                  {message.commandId ? ` / Command ${message.commandId}` : ''}
                </small>
              ) : null}
            </div>
          ))}
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
