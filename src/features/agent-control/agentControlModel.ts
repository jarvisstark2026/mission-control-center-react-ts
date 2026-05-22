import type { ShellRole } from '../shell/roles';
import { mockAgentControlState } from './agentControlMock';
import type {
  AgentActivity,
  AgentControlState,
  AgentJobStatus,
  AgentPermission,
  AgentScheduledJob,
  AgentVisibleRole,
} from './agentControlTypes';

export type AgentJobSummary = {
  total: number;
  active: number;
  paused: number;
  failed: number;
  completed: number;
  nextRunAt: string | null;
};

const editableAgentRoles: ShellRole[] = ['admin'];

function isVisibleRole(role: ShellRole): role is AgentVisibleRole {
  return role !== 'guest';
}

function canSeeRecord(role: ShellRole, visibleTo: AgentVisibleRole[]) {
  return isVisibleRole(role) && visibleTo.includes(role);
}

export function createInitialAgentControlState(): AgentControlState {
  return {
    ...mockAgentControlState,
    identity: { ...mockAgentControlState.identity },
    usage: { ...mockAgentControlState.usage },
    jobs: mockAgentControlState.jobs.map((job) => ({ ...job, visibleTo: [...job.visibleTo] })),
    permissions: mockAgentControlState.permissions.map((permission) => ({
      ...permission,
      visibleTo: [...permission.visibleTo],
    })),
    activity: mockAgentControlState.activity.map((activity) => ({ ...activity, visibleTo: [...activity.visibleTo] })),
  };
}

export function canViewAgentControl(role: ShellRole) {
  return role !== 'guest';
}

export function canEditAgentSettings(role: ShellRole) {
  return editableAgentRoles.includes(role);
}

export function getVisibleAgentJobs(state: AgentControlState, role: ShellRole): AgentScheduledJob[] {
  if (!canViewAgentControl(role)) return [];
  return state.jobs.filter((job) => canSeeRecord(role, job.visibleTo));
}

export function getVisibleAgentPermissions(state: AgentControlState, role: ShellRole): AgentPermission[] {
  if (!canViewAgentControl(role)) return [];
  return state.permissions.filter((permission) => canSeeRecord(role, permission.visibleTo));
}

export function getVisibleAgentActivity(state: AgentControlState, role: ShellRole): AgentActivity[] {
  if (!canViewAgentControl(role)) return [];
  return state.activity.filter((activity) => canSeeRecord(role, activity.visibleTo));
}

function countJobsByStatus(jobs: AgentScheduledJob[], status: AgentJobStatus) {
  return jobs.filter((job) => job.status === status).length;
}

function getNextRunAt(jobs: AgentScheduledJob[]) {
  const next = jobs
    .map((job) => Date.parse(job.nextRunAt))
    .filter((time) => Number.isFinite(time))
    .sort((left, right) => left - right)[0];

  return typeof next === 'number' ? new Date(next).toISOString() : null;
}

export function getAgentJobSummary(jobs: AgentScheduledJob[]): AgentJobSummary {
  return {
    total: jobs.length,
    active: countJobsByStatus(jobs, 'active'),
    paused: countJobsByStatus(jobs, 'paused'),
    failed: countJobsByStatus(jobs, 'failed'),
    completed: countJobsByStatus(jobs, 'completed'),
    nextRunAt: getNextRunAt(jobs),
  };
}

export function getAgentUsageApprovalRate(state: AgentControlState) {
  const totalDecisions = state.usage.approvedActionCount + state.usage.rejectedActionCount + state.usage.blockedActionCount;
  if (totalDecisions === 0) return 0;
  return Math.round((state.usage.approvedActionCount / totalDecisions) * 100);
}
