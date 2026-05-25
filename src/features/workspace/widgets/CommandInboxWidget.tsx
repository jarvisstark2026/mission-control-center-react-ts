import { WorkspaceButton, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame } from '../workspaceBlocks';
import { getAllowedCommandActions, type CommandAction, type CommandRequest, type MissionControlRuntime } from '../../mission-control';
import type { OperationalOsRuntime } from '../../operational-os';
import { AgentAttribution, AttentionCard, AuditList, EvidenceBlock, StatusSummary } from '../operationalBlocks';

const commandActionLabels: Record<CommandAction, string> = {
  approve: 'Approve',
  reject: 'Reject',
  block: 'Block',
  override: 'Override',
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

export function CommandInboxWidget({ missionControl, operationalOs }: { missionControl: MissionControlRuntime; operationalOs: OperationalOsRuntime }) {
  const { commands } = missionControl.state;
  const pendingCommands = commands.filter((command) => command.status === 'pending');
  const completedCommands = commands.filter((command) => command.status !== 'pending');
  const nextCommand = pendingCommands[0];
  const gatewayLabel = missionControl.commandGatewayMode === 'backend' ? 'backend gateway' : 'local gateway';
  const nextAllowedActions = nextCommand ? getAllowedCommandActions(nextCommand, missionControl.role) : [];
  const nextGoal = nextCommand?.goalId ? operationalOs.state.goals.find((goal) => goal.id === nextCommand.goalId) ?? null : null;
  const nextEvidence = nextCommand?.evidenceIds?.length
    ? operationalOs.state.evidence.filter((evidence) => nextCommand.evidenceIds?.includes(evidence.id))
    : [];

  return (
    <WorkspaceContentShell className="mission-control-surface command-inbox-surface">
      <WorkspaceContentHeader
        eyebrow="Command inbox"
        title="primary approval queue"
        metaEyebrow={missionControl.state.connection === 'connected' ? 'live telemetry' : 'mock telemetry'}
        meta={missionControl.role}
      />
      <StatusSummary
        label="Human workstream"
        title={nextCommand ? `Next action: ${nextCommand.title}` : 'No pending action'}
        detail="Agents can propose and explain actions. Operators approve, reject, block, or override by role."
        meta={missionControl.role}
      />

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
        className="mission-control-list-frame command-inbox-mode-frame"
        eyebrow="execution mode"
        title={gatewayLabel}
        meta={`${pendingCommands.length} pending`}
      >
        <div className="mission-control-row command-inbox-mode-row" data-state={missionControl.commandGatewayMode}>
          <span>command endpoint</span>
          <strong>{missionControl.commandGatewayMode === 'backend' ? 'live adapter' : 'browser mock'}</strong>
          <small>{missionControl.commandGatewayMode === 'backend' ? 'approval posts to configured endpoint' : 'approval is persisted locally and simulated'}</small>
        </div>
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="pending"
        title="requests waiting for approval"
        meta={`${pendingCommands.length} active`}
      >
        {pendingCommands.length ? (
          <div className="mission-control-card-list" role="list" aria-label="Pending command requests">
            {pendingCommands.map((command) => {
              const allowedActions = getAllowedCommandActions(command, missionControl.role);

              return (
                <article className="mission-control-card" key={command.id} role="listitem">
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
        eyebrow="history"
        title="recent decisions"
        meta={`${completedCommands.length} resolved`}
      >
        <AuditList
          empty="No command decisions yet."
          items={completedCommands.slice(0, 6).map((command) => ({
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
