import { useMemo, useState } from 'react';

import { getAgentDescriptorById, getVisibleAgentDescriptors, type AgentControlState } from '../../agent-control';
import type { CommandRisk, CommandScope, MissionControlEvent, MissionControlRuntime } from '../../mission-control';
import { canCreateGoal,
  canEditEvidence,
  type Goal,
  type GoalPriority,
  type OperationalOsRuntime } from '../../operational-os';
import type { ShellRole } from '../../shell/roles';
import { AgentAttribution, AttentionCard, AuditList, EvidenceBlock } from '../operationalBlocks';
import { WorkspaceButton, WorkspaceContentShell, WorkspaceEmptyState, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';
import type { WorkspaceWidget } from '../workspaceTypes';

const priorityOptions: GoalPriority[] = ['normal', 'high', 'critical', 'low'];

function formatTime(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return value;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(time));
}

function getGoalRisk(goal: Goal): CommandRisk {
  if (goal.priority === 'critical') return 'critical';
  if (goal.priority === 'high') return 'elevated';
  return 'safe';
}

function getGoalScope(goal: Goal): CommandScope {
  if (goal.title.toLowerCase().includes('home')) return 'household';
  if (goal.priority === 'critical') return 'security';
  return 'system';
}

function createGoalPlanningEvents(goal: Goal, agent: ReturnType<typeof getAgentDescriptorById>): MissionControlEvent[] {
  const timestamp = new Date().toISOString();
  const commandId = `goal-plan-${goal.id}-${Date.now().toString(36)}`;
  const risk = getGoalRisk(goal);

  return [
    {
      type: 'command',
      command: {
        id: commandId,
        title: `Plan goal: ${goal.title}`,
        summary: goal.objective,
        source: 'goal-runtime',
        goalId: goal.id,
        evidenceIds: goal.evidenceIds,
        agent: {
          agentId: agent.id,
          agentName: agent.name,
          profile: agent.profile,
        },
        reasoning: `${agent.name} should decompose this goal into a runbook and evidence-backed proposal before execution.`,
        expectedResult: 'A workflow or agent proposal is prepared, then remains gated by Command Inbox before execution.',
        scope: getGoalScope(goal),
        risk,
        status: 'pending',
        requestedAt: timestamp,
        execution: {
          status: 'not-started',
          result: 'Waiting for approval to begin agent planning for this goal.',
          rollbackAvailable: risk === 'safe',
        },
        auditTrail: [
          {
            id: `audit-${commandId}-proposed`,
            type: 'proposed',
            actor: 'goal-runtime',
            timestamp,
            detail: `${agent.name} was selected to plan goal "${goal.title}".`,
          },
        ],
      },
    },
    {
      type: 'notification',
      notification: {
        id: `notification-${commandId}`,
        level: risk === 'critical' ? 'critical' : risk === 'elevated' ? 'warning' : 'notice',
        title: 'Goal planning request staged',
        body: `Command Inbox is holding "${goal.title}" for approval.`,
        source: 'goal-runtime',
        timestamp,
        acknowledged: false,
        relatedCommandId: commandId,
      },
    },
  ];
}

export function GoalsWidget({
  role,
  missionControl,
  agentControl,
  operationalOs,
  onLaunchWorkspaceWidget,
}: {
  role: ShellRole;
  missionControl: MissionControlRuntime;
  agentControl: AgentControlState;
  operationalOs: OperationalOsRuntime;
  onLaunchWorkspaceWidget: (kind: WorkspaceWidget['kind']) => void;
}) {
  const goals = operationalOs.state.goals;
  const activeGoal = goals.find((goal) => goal.status === 'waiting-approval') ?? goals.find((goal) => goal.status === 'active') ?? goals[0] ?? null;
  const visibleAgents = useMemo(() => getVisibleAgentDescriptors(agentControl, role), [agentControl, role]);
  const defaultAgent = visibleAgents.find((agent) => agent.specialty === 'coordinator') ?? visibleAgents[0] ?? getAgentDescriptorById(agentControl, agentControl.activeAgentId);
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [priority, setPriority] = useState<GoalPriority>('normal');
  const [selectedAgentId, setSelectedAgentId] = useState(defaultAgent.id);
  const [evidenceNote, setEvidenceNote] = useState('');
  const canCreate = canCreateGoal(role);
  const canAttachEvidence = canEditEvidence(role);
  const selectedAgent = getAgentDescriptorById(agentControl, selectedAgentId);
  const waitingCount = goals.filter((goal) => goal.status === 'waiting-approval').length;

  const createNewGoal = () => {
    const goal = operationalOs.createGoal({
      title,
      objective,
      priority,
      ownerRole: role,
      assignedAgentIds: [selectedAgent.id],
    });
    setTitle('');
    setObjective('');
    operationalOs.updateGoalStatus(goal.id, 'active', 'Goal activated from the Goals widget.');
  };

  const stageGoalPlanning = (goal: Goal) => {
    const events = createGoalPlanningEvents(goal, selectedAgent);
    missionControl.ingestEvents(events);
    const commandEvent = events.find((event) => event.type === 'command');
    if (commandEvent?.type === 'command') {
      operationalOs.linkCommandToGoal(goal.id, commandEvent.command.id);
      operationalOs.updateGoalStatus(goal.id, 'waiting-approval', 'Agent planning request is waiting in Command Inbox.');
    }
  };

  const attachEvidence = (goal: Goal) => {
    if (!evidenceNote.trim()) return;
    operationalOs.addEvidence({
      type: 'note',
      title: `Note for ${goal.title}`,
      source: 'goals-widget',
      summary: evidenceNote,
      goalId: goal.id,
    });
    setEvidenceNote('');
  };

  return (
    <WorkspaceContentShell className="mission-control-surface goals-surface">
      <WorkspaceStatusStrip
        source="local"
        status={activeGoal ? activeGoal.title : 'No active goal'}
        count={`${goals.length} stored / ${waitingCount} waiting`}
        updatedAt={activeGoal?.status ?? 'empty'}
        action={{ label: 'Agent Console', onClick: () => onLaunchWorkspaceWidget('agent-console') }}
      />

      {activeGoal ? (
        <AttentionCard
          label={`${activeGoal.priority} / ${activeGoal.status}`}
          title={activeGoal.objective}
          risk={activeGoal.priority === 'critical' ? 'critical' : activeGoal.status === 'blocked' ? 'blocked' : 'notice'}
          actions={
            <>
              <WorkspaceButton variant="primary" disabled={!canCreate} onClick={() => stageGoalPlanning(activeGoal)}>
                Stage agent plan
              </WorkspaceButton>
              <WorkspaceButton variant="secondary" onClick={() => onLaunchWorkspaceWidget('agent-console')}>
                Open Agent Console
              </WorkspaceButton>
              <WorkspaceButton variant="secondary" onClick={() => onLaunchWorkspaceWidget('flow')}>
                Open Workflow
              </WorkspaceButton>
            </>
          }
        >
          <AgentAttribution agent={selectedAgent} profile={selectedAgent.profile} />
          <EvidenceBlock label="linked records" title={`${activeGoal.commandIds.length} commands / ${activeGoal.evidenceIds.length} evidence`}>
            Created {formatTime(activeGoal.createdAt)}. Updated {formatTime(activeGoal.updatedAt)}.
          </EvidenceBlock>
          <AuditList
            empty="No audit entries yet."
            items={activeGoal.auditTrail.slice(-4).map((entry) => ({
              id: entry.id,
              title: entry.detail,
              meta: `${entry.type} / ${entry.actor}`,
              detail: formatTime(entry.timestamp),
              state: entry.type,
            }))}
          />
          <label className="goals-note-field">
            <span>evidence note</span>
            <textarea value={evidenceNote} onChange={(event) => setEvidenceNote(event.currentTarget.value)} rows={3} />
          </label>
          <WorkspaceButton variant="secondary" disabled={!canAttachEvidence || !evidenceNote.trim()} onClick={() => attachEvidence(activeGoal)}>
            Attach note
          </WorkspaceButton>
        </AttentionCard>
      ) : null}

      <WorkspaceSectionFrame className="mission-control-list-frame goals-create-frame" eyebrow="create" title="new goal" meta={canCreate ? 'enabled' : 'read only'}>
        {canCreate ? (
          <>
            <label className="goals-field">
              <span>title</span>
              <input value={title} onChange={(event) => setTitle(event.currentTarget.value)} placeholder="What should Mission Control accomplish?" />
            </label>
            <label className="goals-field">
              <span>objective</span>
              <textarea value={objective} onChange={(event) => setObjective(event.currentTarget.value)} rows={3} placeholder="Describe the outcome and constraints." />
            </label>
            <div className="agent-console-selector-row" role="group" aria-label="Goal priority">
              {priorityOptions.map((item) => (
                <button key={item} type="button" className="agent-console-chip" aria-pressed={priority === item} onClick={() => setPriority(item)}>
                  {item}
                </button>
              ))}
            </div>
            <div className="agent-console-selector-row" role="group" aria-label="Goal agent">
              {visibleAgents.map((agent) => (
                <button key={agent.id} type="button" className="agent-console-chip" aria-pressed={selectedAgentId === agent.id} onClick={() => setSelectedAgentId(agent.id)}>
                  {agent.name}
                </button>
              ))}
            </div>
            <WorkspaceButton variant="primary" disabled={!title.trim()} onClick={createNewGoal}>
              Create goal
            </WorkspaceButton>
          </>
        ) : (
          <WorkspaceEmptyState source="local" title="Read-only goals" detail="Guest access can inspect existing goals but cannot create new objectives." />
        )}
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame className="mission-control-list-frame" eyebrow="goal queue" title="active and archived" meta={`${goals.length} stored`}>
        <div className="mission-control-compact-list" role="list" aria-label="Goals">
          {goals.map((goal) => (
            <div className="mission-control-row" key={goal.id} role="listitem" data-state={goal.status}>
              <span>{goal.priority} / {goal.status}</span>
              <strong>{goal.title}</strong>
              <small>{goal.commandIds.length} commands / {goal.evidenceIds.length} evidence</small>
              <p>{goal.objective}</p>
            </div>
          ))}
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
