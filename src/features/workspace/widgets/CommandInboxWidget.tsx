import { WorkspaceButton, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';
import { getAllowedCommandActions, type CommandAction, type CommandRequest, type MissionControlRuntime } from '../../mission-control';

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

  return (
    <WorkspaceContentShell className="mission-control-surface command-inbox-surface">
      <WorkspaceContentHeader
        eyebrow="Command inbox"
        title="primary approval queue"
        metaEyebrow={missionControl.state.connection === 'connected' ? 'live backend' : 'mock/local'}
        meta={missionControl.role}
      />
      <WorkspaceSummaryPanel
        className="mission-control-summary"
        title={nextCommand ? `Next action: ${nextCommand.title}` : 'No pending action'}
      >
        Command Inbox is the main human workstream. The agent can propose and explain actions; operators approve, reject, block, or override by role.
      </WorkspaceSummaryPanel>

      <WorkspaceSectionFrame
        className="mission-control-list-frame command-inbox-mode-frame"
        eyebrow="execution mode"
        title={missionControl.state.connection === 'connected' ? 'backend connected' : 'mock command lane'}
        meta={`${pendingCommands.length} pending`}
      >
        <div className="mission-control-row command-inbox-mode-row" data-state={missionControl.state.connection}>
          <span>command endpoint</span>
          <strong>{missionControl.state.connection === 'connected' ? 'live' : 'local mock'}</strong>
          <small>approvals do not execute real actions yet</small>
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
        {completedCommands.length ? (
          <div className="mission-control-compact-list" role="list" aria-label="Resolved command requests">
            {completedCommands.slice(0, 6).map((command) => (
              <div className="mission-control-row" key={command.id} role="listitem" data-state={command.status}>
                <span>{command.title}</span>
                <strong>{command.execution.status}</strong>
                <small>{command.decidedBy ?? 'system'} / {command.auditTrail.length} audit</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="mission-control-empty">No command decisions yet.</p>
        )}
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
