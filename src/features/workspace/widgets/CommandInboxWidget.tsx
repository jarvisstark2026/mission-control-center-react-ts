import { WorkspaceButton, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame } from '../workspaceBlocks';
import { getAllowedCommandActions, type CommandAction, type CommandRequest, type MissionControlRuntime } from '../../mission-control';
import { AgentAttribution, AttentionCard, AuditList, EvidenceBlock, StatusSummary } from '../operationalBlocks';

const commandActionLabels: Record<CommandAction, string> = {
  approve: 'Approve',
  reject: 'Reject',
  block: 'Block',
  override: 'Override',
};

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

export function CommandInboxWidget({ missionControl }: { missionControl: MissionControlRuntime }) {
  const { commands } = missionControl.state;
  const pendingCommands = commands.filter((command) => command.status === 'pending');
  const completedCommands = commands.filter((command) => command.status !== 'pending');
  const nextCommand = pendingCommands[0];
  const gatewayLabel = missionControl.commandGatewayMode === 'backend' ? 'backend gateway' : 'local gateway';

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
            getAllowedCommandActions(nextCommand, missionControl.role).length ? (
              <>
                {getAllowedCommandActions(nextCommand, missionControl.role).map((action) => (
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
          <EvidenceBlock label="Why">{nextCommand.reasoning}</EvidenceBlock>
          <EvidenceBlock label="Expected result">{nextCommand.expectedResult}</EvidenceBlock>
          <EvidenceBlock label="Origin">{nextCommand.source}</EvidenceBlock>
          <EvidenceBlock label="Execution state">{nextCommand.execution.result}</EvidenceBlock>
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
                    <small>{command.source}</small>
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
