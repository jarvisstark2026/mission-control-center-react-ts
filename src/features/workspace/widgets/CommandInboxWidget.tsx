import { useState } from 'react';

import { WorkspaceButton, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame } from '../workspaceBlocks';
import { getAllowedCommandActions, type CommandAction, type CommandRequest, type MissionControlRuntime } from '../../mission-control';
import type { OperationalOsRuntime } from '../../operational-os';
import { AgentAttribution, AttentionCard, AuditList, EvidenceBlock, StatusSummary } from '../operationalBlocks';
import { getCommandGatewayDisplay } from './agentWorkflowDisplay';

const commandActionLabels: Record<CommandAction, string> = {
  approve: 'Approve',
  reject: 'Reject',
  block: 'Block',
  override: 'Override',
};

type CommandInboxFilter = 'pending' | 'agent' | 'workflow' | 'home' | 'high-risk' | 'history';

const commandFilterLabels: Record<CommandInboxFilter, string> = {
  pending: 'Pending',
  agent: 'Agent',
  workflow: 'Workflow',
  home: 'Home',
  'high-risk': 'High risk',
  history: 'History',
};

function getCommandOriginLabel(command: CommandRequest) {
  if (command.source.startsWith('home-systems:')) {
    return `Home Systems / ${command.source.replace('home-systems:', '')}`;
  }

  if (command.source === 'workflow-runbook') {
    return command.workflow ? `Workflow / ${command.workflow.workflowName}` : 'Workflow runbook';
  }

  if (command.source.startsWith('agent-console')) {
    return 'Agent Console';
  }

  return command.source;
}

function formatDateTime(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return value;

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

function CommandActionButton({
  action,
  command,
  missionControl,
}: {
  action: CommandAction;
  command: CommandRequest;
  missionControl: MissionControlRuntime;
}) {
  return (
    <WorkspaceButton
      variant={action === 'override' || action === 'block' ? 'destructive' : action === 'approve' ? 'primary' : 'secondary'}
      className="mission-control-action"
      onClick={() => missionControl.actOnCommand(command.id, action)}
    >
      {commandActionLabels[action]}
    </WorkspaceButton>
  );
}

export function CommandInboxWidget({
  missionControl,
  operationalOs,
  focusedCommandId = null,
  onClearFocusedCommand,
}: {
  missionControl: MissionControlRuntime;
  operationalOs: OperationalOsRuntime;
  focusedCommandId?: string | null;
  onClearFocusedCommand?: () => void;
}) {
  const [activeFilter, setActiveFilter] = useState<CommandInboxFilter>('pending');
  const { commands } = missionControl.state;
  const pendingCommands = commands.filter((command) => command.status === 'pending');
  const completedCommands = commands.filter((command) => command.status !== 'pending');
  const executionCommands = commands.filter((command) => command.execution.status !== 'not-started' || command.status !== 'pending');
  const focusedCommand = focusedCommandId ? commands.find((command) => command.id === focusedCommandId) ?? null : null;
  const nextCommand = focusedCommand ?? pendingCommands[0];
  const gatewayDisplay = getCommandGatewayDisplay(missionControl.commandGatewayMode);
  const nextAllowedActions = nextCommand ? getAllowedCommandActions(nextCommand, missionControl.role) : [];
  const nextGoal = nextCommand?.goalId ? operationalOs.state.goals.find((goal) => goal.id === nextCommand.goalId) ?? null : null;
  const nextEvidence = nextCommand?.evidenceIds?.length
    ? operationalOs.state.evidence.filter((evidence) => nextCommand.evidenceIds?.includes(evidence.id))
    : [];
  const filteredCommands = commands.filter((command) => {
    if (activeFilter === 'pending') return command.status === 'pending';
    if (activeFilter === 'agent') return command.source.includes('agent') || command.source === 'agent-console' || command.source === 'agent-control';
    if (activeFilter === 'workflow') return command.source === 'workflow-runbook' || Boolean(command.workflow);
    if (activeFilter === 'home') return command.source.startsWith('home') || command.scope === 'household';
    if (activeFilter === 'high-risk') return command.risk === 'critical' || command.risk === 'elevated';
    return command.status !== 'pending';
  });
  const filteredPendingCommands = filteredCommands.filter((command) => command.status === 'pending');
  const filterCounts: Record<CommandInboxFilter, number> = {
    pending: pendingCommands.length,
    agent: commands.filter((command) => command.source.includes('agent')).length,
    workflow: commands.filter((command) => command.source === 'workflow-runbook' || command.workflow).length,
    home: commands.filter((command) => command.source.startsWith('home') || command.scope === 'household').length,
    'high-risk': commands.filter((command) => command.risk === 'critical' || command.risk === 'elevated').length,
    history: completedCommands.length,
  };

  return (
    <WorkspaceContentShell className="mission-control-surface command-inbox-surface">
      <WorkspaceContentHeader
        eyebrow="Command inbox"
        title="primary approval queue"
        metaEyebrow="operator gate"
        meta={missionControl.role}
      />
      <StatusSummary
        label="Human workstream"
        title={nextCommand ? `${focusedCommand ? 'Focused command' : 'Next action'}: ${nextCommand.title}` : 'No pending action'}
        detail={focusedCommand ? 'Opened from Agent Console or Workflow. This command remains gated here.' : 'Agents can propose and explain actions. Operators approve, reject, block, or override by role.'}
        meta={missionControl.role}
      />
      {focusedCommand ? (
        <div className="mission-control-actions command-inbox-focus-actions">
          <WorkspaceButton variant="compact" onClick={() => setActiveFilter(focusedCommand.status === 'pending' ? 'pending' : 'history')}>
            Show in list
          </WorkspaceButton>
          {onClearFocusedCommand ? (
            <WorkspaceButton variant="compact" onClick={onClearFocusedCommand}>
              Clear focus
            </WorkspaceButton>
          ) : null}
        </div>
      ) : null}

      {nextCommand ? (
        <AttentionCard
          label={`${nextCommand.scope} / ${nextCommand.source}`}
          title={nextCommand.title}
          risk={nextCommand.risk}
          actions={
            nextAllowedActions.length ? (
              <>
                {nextAllowedActions.map((action) => (
                  <CommandActionButton key={action} action={action} command={nextCommand} missionControl={missionControl} />
                ))}
              </>
            ) : (
              <p className="mission-control-muted">Read-only for this access scope.</p>
            )
          }
        >
          <AgentAttribution
            agent={{ name: nextCommand.agent.agentName, specialty: 'proposal owner' }}
            profile={nextCommand.agent.profile}
          />
          <EvidenceBlock label="Origin" title={getCommandOriginLabel(nextCommand)}>
            Requested {formatDateTime(nextCommand.requestedAt)}. Source remains evidence-only until this inbox approves the command.
          </EvidenceBlock>
          {nextGoal ? (
            <EvidenceBlock label="Goal" title={nextGoal.title}>
              {nextGoal.objective}
            </EvidenceBlock>
          ) : null}
          {nextEvidence.length ? (
            <EvidenceBlock label="Evidence" title={`${nextEvidence.length} linked records`}>
              {nextEvidence.slice(0, 3).map((evidence) => evidence.title).join(' / ')}
            </EvidenceBlock>
          ) : null}
          <EvidenceBlock label="Why">{nextCommand.reasoning}</EvidenceBlock>
          <EvidenceBlock label="Expected result">{nextCommand.expectedResult}</EvidenceBlock>
          <EvidenceBlock label="Role gate" title={nextAllowedActions.length ? nextAllowedActions.join(' / ') : 'read only'}>
            {nextAllowedActions.length ? `This ${missionControl.role} scope can decide the request.` : 'This access scope can inspect the proposal but cannot execute it.'}
          </EvidenceBlock>
          <EvidenceBlock label="Execution state" title={nextCommand.execution.status}>{nextCommand.execution.result}</EvidenceBlock>
          {nextCommand.workflow ? (
            <EvidenceBlock label="Workflow link" title={nextCommand.workflow.workflowName}>
              Step {nextCommand.workflow.stepId} waits for this decision before the runbook can progress.
            </EvidenceBlock>
          ) : null}
          <AuditList
            empty="No audit events yet."
            items={nextCommand.auditTrail.slice(-4).map((entry) => ({
              id: entry.id,
              title: entry.detail,
              meta: `${entry.type} / ${entry.actor}`,
              detail: formatDateTime(entry.timestamp),
              state: entry.type,
            }))}
          />
        </AttentionCard>
      ) : null}

      <WorkspaceSectionFrame
        className="mission-control-list-frame command-inbox-filter-frame"
        eyebrow="decision filters"
        title="triage"
        meta={`${filteredCommands.length} shown`}
      >
        <div className="agent-console-selector-row" role="tablist" aria-label="Command Inbox filters">
          {(Object.keys(commandFilterLabels) as CommandInboxFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              className="agent-console-chip"
              aria-selected={activeFilter === filter}
              aria-pressed={activeFilter === filter}
              onClick={() => setActiveFilter(filter)}
            >
              {commandFilterLabels[filter]} {filterCounts[filter]}
            </button>
          ))}
        </div>
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame
        className="mission-control-list-frame command-inbox-mode-frame"
        eyebrow="execution mode"
        title={gatewayDisplay.label}
        meta={`${pendingCommands.length} pending`}
      >
        <div className="mission-control-row command-inbox-mode-row" data-state={gatewayDisplay.state}>
          <span>command endpoint</span>
          <strong>{gatewayDisplay.meta}</strong>
          <small>{gatewayDisplay.detail}</small>
        </div>
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="pending"
        title={activeFilter === 'history' ? 'history filter selected' : 'requests waiting for approval'}
        meta={`${filteredPendingCommands.length} active`}
      >
        {filteredPendingCommands.length ? (
          <div className="mission-control-card-list" role="list" aria-label="Pending command requests">
            {filteredPendingCommands.map((command) => {
              const allowedActions = getAllowedCommandActions(command, missionControl.role);

              return (
                <article className="mission-control-card" key={command.id} role="listitem" data-focused={command.id === focusedCommandId ? 'true' : 'false'}>
                  <div className="mission-control-card-head">
                    <div>
                      <span>{command.scope} / {command.risk}</span>
                      <strong>{command.title}</strong>
                    </div>
                    <small>{getCommandOriginLabel(command)}</small>
                  </div>
                  <p>{command.summary}</p>
                  <div className="command-inbox-explain">
                    <div>
                      <span>agent</span>
                      <strong>{command.agent.agentName}</strong>
                      <small>{command.agent.profile}</small>
                    </div>
                    <div>
                      <span>why</span>
                      <p>{command.reasoning}</p>
                    </div>
                    <div>
                      <span>expected result</span>
                      <p>{command.expectedResult}</p>
                    </div>
                  </div>
                  {allowedActions.length ? (
                    <div className="mission-control-actions">
                      {allowedActions.map((action) => (
                        <CommandActionButton
                          key={action}
                          action={action}
                          command={command}
                          missionControl={missionControl}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="mission-control-muted">Read-only for this access scope.</p>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mission-control-empty">No commands are waiting for action.</p>
        )}
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="execution / results"
        title={missionControl.commandGatewayMode === 'backend' ? 'execution history' : 'local dry-run history'}
        meta={`${executionCommands.length} tracked`}
      >
        <AuditList
          empty="No command has entered execution yet."
          items={executionCommands.slice(0, 8).map((command) => ({
            id: `${command.id}-execution`,
            title: command.title,
            detail: `${command.execution.status}: ${command.execution.result}`,
            meta: `${getCommandOriginLabel(command)} / ${command.status}`,
            state: command.execution.status,
          }))}
        />
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="audit"
        title="recent decisions"
        meta={`${completedCommands.length} resolved`}
      >
        <AuditList
          empty="No command decisions yet."
          items={(activeFilter === 'history' ? filteredCommands : completedCommands).slice(0, 6).map((command) => ({
            id: command.id,
            title: command.title,
            detail: command.execution.result,
            meta: `${command.status} / ${command.decidedBy ?? 'system'} / ${command.auditTrail.length} audit`,
            state: command.status,
          }))}
        />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
