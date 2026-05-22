import { useMemo, useState } from 'react';

import {
  canSubmitAgentTask,
  canViewAgentConsole,
  getAgentTaskScopesForRole,
  useAgentTasking,
  type AgentTaskScope,
} from '../../agent-tasking';
import { getAgentDescriptorById, getVisibleAgentDescriptors, type AgentControlState } from '../../agent-control';
import type { CommandRisk, MissionControlRuntime } from '../../mission-control';
import type { ShellRole } from '../../shell/roles';
import { AgentAttribution, AttentionCard, EvidenceBlock, StatusSummary } from '../operationalBlocks';
import {
  WorkspaceButton,
  WorkspaceContentHeader,
  WorkspaceContentShell,
  WorkspaceSectionFrame,
  WorkspaceSummaryPanel,
} from '../workspaceBlocks';

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
}: {
  role: ShellRole;
  missionControl: MissionControlRuntime;
  agentControl: AgentControlState;
}) {
  const tasking = useAgentTasking(role, missionControl.ingestEvents);
  const availableScopes = useMemo(() => getAgentTaskScopesForRole(role), [role]);
  const visibleAgents = useMemo(() => getVisibleAgentDescriptors(agentControl, role), [agentControl, role]);
  const defaultAgent = visibleAgents.find((agent) => agent.specialty === 'coordinator') ?? visibleAgents[0] ?? getAgentDescriptorById(agentControl, agentControl.activeAgentId);
  const [objective, setObjective] = useState(() => getDefaultObjective(role));
  const [scope, setScope] = useState<AgentTaskScope>(() => getDefaultScope(role));
  const [risk, setRisk] = useState<CommandRisk>(() => getDefaultRisk(role));
  const [targetAgentId, setTargetAgentId] = useState(defaultAgent.id);
  const targetAgent = getAgentDescriptorById(agentControl, targetAgentId);
  const canView = canViewAgentConsole(role);
  const canSubmit = canSubmitAgentTask(role, { scope, risk });

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
    void tasking.submitTask(objective, scope, risk, targetAgent.id);
  };

  return (
    <WorkspaceContentShell className="mission-control-surface agent-console-surface">
      <WorkspaceContentHeader
        eyebrow="Agent console"
        title="tasking / proposals"
        metaEyebrow="gateway"
        meta={tasking.gatewayMode}
      />

      <StatusSummary
        label="Tasking status"
        title="Proposal only"
        detail="Agent Console creates proposals only. Command Inbox remains the approval and execution gate."
        meta={tasking.state.status}
      />

      <WorkspaceSectionFrame
        className="mission-control-list-frame agent-console-compose"
        eyebrow="current request"
        title="objective"
        meta={tasking.state.status}
      >
        <AttentionCard label="Selected agent" title={targetAgent.name} risk={risk}>
          <AgentAttribution agent={targetAgent} profile={targetAgent.profile} />
          <p>{targetAgent.summary}</p>
        </AttentionCard>
        <div className="agent-console-selector-row" role="group" aria-label="Target agent">
          {visibleAgents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              className="agent-console-chip"
              aria-pressed={targetAgentId === agent.id}
              onClick={() => setTargetAgentId(agent.id)}
            >
              {agent.name}
            </button>
          ))}
        </div>
        <label className="agent-console-field">
          <span>objective</span>
          <textarea
            value={objective}
            rows={4}
            onChange={(event) => setObjective(event.currentTarget.value)}
            aria-label="Agent task objective"
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
        <WorkspaceButton
          variant="primary"
          className="agent-console-submit"
          disabled={!canSubmit || tasking.state.status === 'drafting'}
          onClick={submitTask}
        >
          Send to Jarvis
        </WorkspaceButton>
        {!canSubmit ? <p className="mission-control-muted">This role cannot submit that scope/risk combination.</p> : null}
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="proposals"
        title="sent to Command Inbox"
        meta={`${tasking.state.proposals.length} staged`}
      >
        {tasking.state.proposals.length ? (
          <div className="mission-control-compact-list" role="list" aria-label="Agent proposals">
            {tasking.state.proposals.slice(0, 5).map((proposal) => (
              <div className="mission-control-row" key={proposal.id} role="listitem" data-state={proposal.risk}>
                <span>{proposal.title}</span>
                <strong>{proposal.agentName ?? 'Jarvis Prime'}</strong>
                <small>{proposal.scope} / {proposal.risk} / {formatTime(proposal.timestamp)}</small>
                <p>{proposal.reasoning}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mission-control-empty">No proposals have been staged from this console yet.</p>
        )}
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="conversation"
        title="recent exchange"
        meta={`${tasking.state.messages.length} messages`}
      >
        <div className="mission-control-compact-list" role="list" aria-label="Agent console conversation">
          {tasking.state.messages.slice(0, 7).map((message) => (
            <div className="mission-control-row" key={message.id} role="listitem" data-state={message.author}>
              <span>{message.author}</span>
              <strong>{formatTime(message.timestamp)}</strong>
              <EvidenceBlock label="message">{message.body}</EvidenceBlock>
            </div>
          ))}
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
