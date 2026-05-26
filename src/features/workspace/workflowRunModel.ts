import { createId } from '../../lib/createId';
import type { AgentDescriptor } from '../agent-control';
import type { CommandRequest, CommandRisk, CommandScope, MissionControlEvent } from '../mission-control';
import { getWorkflowSteps, getWorkflowTemplate, type WorkflowDraft } from './workflowStudioModel';

export type WorkflowStepStatus = 'pending' | 'active' | 'waiting-approval' | 'running' | 'completed' | 'blocked' | 'failed';
export type WorkflowStepAssignee = 'user' | 'agent' | 'agent-team';
export type WorkflowApprovalRequirement = 'none' | 'command';

export type WorkflowRunStep = {
  id: string;
  title: string;
  assignee: WorkflowStepAssignee;
  status: WorkflowStepStatus;
  approvalRequirement: WorkflowApprovalRequirement;
  requiredCapability?: string;
  risk?: CommandRisk;
  expectedOutput?: string;
  evidenceRequirement?: string;
  agentId?: string;
  commandId?: string;
  note?: string;
};

export type WorkflowRun = {
  id: string;
  workflowId: string;
  workflowName: string;
  templateId: string;
  goalId?: string;
  evidenceIds: string[];
  status: 'active' | 'waiting-approval' | 'completed' | 'blocked' | 'failed';
  startedAt: string;
  updatedAt: string;
  steps: WorkflowRunStep[];
  auditTrail: WorkflowRunAuditEntry[];
};

export type WorkflowRunAuditEntry = {
  id: string;
  type: 'started' | 'step-completed' | 'step-blocked' | 'step-note' | 'approval-staged' | 'agent-requested' | 'command-synced';
  actor: string;
  timestamp: string;
  detail: string;
};

type WorkflowCommandProfile = {
  scope: CommandScope;
  risk: CommandRisk;
  systemLabel: string;
};

const workflowCommandProfiles: Record<string, WorkflowCommandProfile> = {
  'solar-surplus-optimization': { scope: 'household', risk: 'safe', systemLabel: 'Home energy' },
  'night-energy-saving': { scope: 'household', risk: 'safe', systemLabel: 'Home energy' },
  'leave-home-security': { scope: 'security', risk: 'critical', systemLabel: 'Home security' },
  'support-diagnostics': { scope: 'support', risk: 'elevated', systemLabel: 'Support diagnostics' },
  'emergency-safety-check': { scope: 'security', risk: 'critical', systemLabel: 'Emergency safety' },
};

type WorkflowStepPolicy = {
  assignee: WorkflowStepAssignee;
  approvalRequirement: WorkflowApprovalRequirement;
  requiredCapability: string;
  risk: CommandRisk;
  expectedOutput: string;
  evidenceRequirement: string;
};

const defaultStepPolicy: WorkflowStepPolicy = {
  assignee: 'user',
  approvalRequirement: 'none',
  requiredCapability: 'operator-review',
  risk: 'safe',
  expectedOutput: 'Step completed or recorded by the operator.',
  evidenceRequirement: 'operator note',
};

const workflowStepPolicies: Record<string, WorkflowStepPolicy[]> = {
  'agent-brief': [
    { ...defaultStepPolicy, assignee: 'user', requiredCapability: 'goal-capture', expectedOutput: 'Goal is clear enough for agent planning.' },
    { ...defaultStepPolicy, assignee: 'agent', requiredCapability: 'constraint-discovery', expectedOutput: 'Agent summarizes constraints and unknowns.' },
    { ...defaultStepPolicy, assignee: 'agent', requiredCapability: 'skill-routing', expectedOutput: 'Agent recommends the right specialist path.' },
    { ...defaultStepPolicy, assignee: 'agent', approvalRequirement: 'command', requiredCapability: 'task-execution', risk: 'elevated', expectedOutput: 'Execution proposal is staged in Command Inbox.' },
    { ...defaultStepPolicy, assignee: 'user', requiredCapability: 'verification', expectedOutput: 'User verifies the delivered result.' },
  ],
  'workflow-studio': [
    { ...defaultStepPolicy, assignee: 'user', requiredCapability: 'authoring', expectedOutput: 'Workflow has a useful name.' },
    { ...defaultStepPolicy, assignee: 'user', requiredCapability: 'template-selection', expectedOutput: 'A workflow template is selected.' },
    { ...defaultStepPolicy, assignee: 'agent', requiredCapability: 'skill-selection', expectedOutput: 'Helper skills are attached.' },
    { ...defaultStepPolicy, assignee: 'user', requiredCapability: 'step-editing', expectedOutput: 'User-specific steps are added.' },
    { ...defaultStepPolicy, assignee: 'agent', approvalRequirement: 'command', requiredCapability: 'export', risk: 'safe', expectedOutput: 'Export or handout action is gated.' },
  ],
  'solar-surplus-optimization': [
    { ...defaultStepPolicy, assignee: 'agent', requiredCapability: 'home-energy-read', expectedOutput: 'Solar surplus is measured.' },
    { ...defaultStepPolicy, assignee: 'agent', requiredCapability: 'load-ranking', expectedOutput: 'Flexible loads are ranked.' },
    { ...defaultStepPolicy, assignee: 'agent', approvalRequirement: 'command', requiredCapability: 'ev-battery-control', risk: 'safe', expectedOutput: 'EV or battery command is staged.' },
    { ...defaultStepPolicy, assignee: 'user', requiredCapability: 'approval', expectedOutput: 'Command Inbox decision is recorded.' },
    { ...defaultStepPolicy, assignee: 'agent', requiredCapability: 'verification', expectedOutput: 'Grid import impact is checked.' },
  ],
  'leave-home-security': [
    { ...defaultStepPolicy, assignee: 'agent', requiredCapability: 'occupancy-read', expectedOutput: 'Occupancy state is known.' },
    { ...defaultStepPolicy, assignee: 'agent', approvalRequirement: 'command', requiredCapability: 'window-control', risk: 'elevated', expectedOutput: 'Window close request is staged.' },
    { ...defaultStepPolicy, assignee: 'agent', requiredCapability: 'camera-read', expectedOutput: 'Camera and doorbell health are checked.' },
    { ...defaultStepPolicy, assignee: 'agent', approvalRequirement: 'command', requiredCapability: 'alarm-control', risk: 'critical', expectedOutput: 'Alarm arm request is staged.' },
    { ...defaultStepPolicy, assignee: 'agent', requiredCapability: 'verification', expectedOutput: 'Perimeter state is confirmed.' },
  ],
  'night-energy-saving': [
    { ...defaultStepPolicy, assignee: 'user', requiredCapability: 'schedule-read', expectedOutput: 'Next routine block is reviewed.' },
    { ...defaultStepPolicy, assignee: 'agent', approvalRequirement: 'command', requiredCapability: 'ac-control', risk: 'safe', expectedOutput: 'AC reduction request is staged.' },
    { ...defaultStepPolicy, assignee: 'agent', approvalRequirement: 'command', requiredCapability: 'appliance-control', risk: 'safe', expectedOutput: 'Flexible load pause request is staged.' },
    { ...defaultStepPolicy, assignee: 'agent', approvalRequirement: 'command', requiredCapability: 'pool-control', risk: 'safe', expectedOutput: 'Pool pump schedule request is staged.' },
    { ...defaultStepPolicy, assignee: 'agent', requiredCapability: 'comfort-read', expectedOutput: 'Comfort band remains acceptable.' },
  ],
  'support-diagnostics': [
    { ...defaultStepPolicy, assignee: 'agent', requiredCapability: 'integration-read', expectedOutput: 'Heartbeats are collected.' },
    { ...defaultStepPolicy, assignee: 'agent', requiredCapability: 'device-review', expectedOutput: 'Degraded devices are identified.' },
    { ...defaultStepPolicy, assignee: 'agent', approvalRequirement: 'command', requiredCapability: 'diagnostic-command', risk: 'elevated', expectedOutput: 'Diagnostic command is staged.' },
    { ...defaultStepPolicy, assignee: 'agent', requiredCapability: 'findings', expectedOutput: 'Diagnostic findings are captured.' },
    { ...defaultStepPolicy, assignee: 'user', requiredCapability: 'escalation-review', expectedOutput: 'Escalation decision is made.' },
  ],
  'emergency-safety-check': [
    { ...defaultStepPolicy, assignee: 'agent', requiredCapability: 'safety-read', risk: 'critical', expectedOutput: 'Safety sensors are checked.' },
    { ...defaultStepPolicy, assignee: 'agent', requiredCapability: 'alarm-read', risk: 'critical', expectedOutput: 'Alarm panel state is known.' },
    { ...defaultStepPolicy, assignee: 'agent', requiredCapability: 'cctv-read', risk: 'critical', expectedOutput: 'NVR health is reviewed.' },
    { ...defaultStepPolicy, assignee: 'agent', approvalRequirement: 'command', requiredCapability: 'critical-action', risk: 'critical', expectedOutput: 'Critical action is staged if needed.' },
    { ...defaultStepPolicy, assignee: 'user', requiredCapability: 'audit', risk: 'critical', expectedOutput: 'Safety audit note is recorded.' },
  ],
};

const workflowRunStorageKey = 'mission-control.workflowRuns.v1';
const maxPersistedWorkflowRuns = 12;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function createWorkflowRunAudit(
  type: WorkflowRunAuditEntry['type'],
  actor: string,
  detail: string,
  timestamp = new Date().toISOString(),
): WorkflowRunAuditEntry {
  return {
    id: createId(`workflow-audit-${type}`),
    type,
    actor,
    timestamp,
    detail,
  };
}

function capAuditTrail(entries: WorkflowRunAuditEntry[]) {
  return entries.slice(-18);
}

function getRunStatusFromSteps(steps: WorkflowRunStep[]): WorkflowRun['status'] {
  if (steps.some((step) => step.status === 'failed')) return 'failed';
  if (steps.some((step) => step.status === 'blocked')) return 'blocked';
  if (steps.every((step) => step.status === 'completed')) return 'completed';
  if (steps.some((step) => step.status === 'waiting-approval')) return 'waiting-approval';
  return 'active';
}

function isWorkflowRunStep(value: unknown): value is WorkflowRunStep {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.assignee === 'string' &&
    typeof value.status === 'string' &&
    typeof value.approvalRequirement === 'string'
  );
}

function isWorkflowRun(value: unknown): value is WorkflowRun {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.workflowId === 'string' &&
    typeof value.workflowName === 'string' &&
    typeof value.templateId === 'string' &&
    typeof value.status === 'string' &&
    typeof value.startedAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    Array.isArray(value.steps) &&
    value.steps.every(isWorkflowRunStep)
  );
}

export function loadWorkflowRuns(): WorkflowRun[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(workflowRunStorageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isWorkflowRun)
      .map((run) => ({
        ...run,
        evidenceIds: Array.isArray(run.evidenceIds) ? run.evidenceIds.filter((item) => typeof item === 'string') : [],
        auditTrail: Array.isArray(run.auditTrail) ? run.auditTrail.filter(isRecord).map((entry) => ({
          id: typeof entry.id === 'string' ? entry.id : createId('workflow-audit'),
          type: typeof entry.type === 'string' ? entry.type as WorkflowRunAuditEntry['type'] : 'started',
          actor: typeof entry.actor === 'string' ? entry.actor : 'workflow',
          timestamp: typeof entry.timestamp === 'string' ? entry.timestamp : new Date().toISOString(),
          detail: typeof entry.detail === 'string' ? entry.detail : 'Workflow run restored.',
        })) : [],
      }))
      .slice(0, maxPersistedWorkflowRuns);
  } catch {
    return [];
  }
}

export function saveWorkflowRuns(runs: WorkflowRun[]) {
  if (typeof window === 'undefined') return true;

  try {
    window.localStorage.setItem(workflowRunStorageKey, JSON.stringify(runs.slice(0, maxPersistedWorkflowRuns)));
    return true;
  } catch {
    return false;
  }
}

function getStepPolicy(templateId: string, index: number): WorkflowStepPolicy {
  return workflowStepPolicies[templateId]?.[index] ?? {
    ...defaultStepPolicy,
    assignee: index === 0 ? 'user' : 'agent',
    approvalRequirement: 'none',
  };
}

function getWorkflowCommandProfile(run: WorkflowRun, agent: AgentDescriptor): WorkflowCommandProfile {
  const templateProfile = workflowCommandProfiles[run.templateId];
  if (templateProfile) return templateProfile;

  return {
    scope: agent.specialty === 'home' ? 'household' : agent.specialty === 'security' ? 'security' : 'system',
    risk: agent.specialty === 'security' ? 'critical' : 'elevated',
    systemLabel: agent.specialty,
  };
}

export function startWorkflowRun(
  workflow: WorkflowDraft,
  agent: AgentDescriptor,
  now = new Date().toISOString(),
  context: { goalId?: string; evidenceIds?: string[] } = {},
): WorkflowRun {
  const workflowId = workflow.id ?? createId('workflow');
  const template = getWorkflowTemplate(workflow.templateId);
  const steps = getWorkflowSteps(workflow);
  const workflowName = workflow.name.trim() || `${template.title} workflow`;

  return {
    id: createId('workflow-run'),
    workflowId,
    workflowName,
    templateId: template.id,
    goalId: context.goalId,
    evidenceIds: context.evidenceIds ?? [],
    status: 'active',
    startedAt: now,
    updatedAt: now,
    auditTrail: [
      createWorkflowRunAudit(
        'started',
        'workflow',
        `Runbook "${workflowName}" started with ${agent.name}.`,
        now,
      ),
    ],
    steps: steps.map((step, index) => {
      const policy = getStepPolicy(template.id, index);
      return {
        id: `${workflowId}-step-${index + 1}`,
        title: step,
        assignee: policy.assignee,
        status: index === 0 ? 'active' : policy.approvalRequirement === 'command' ? 'waiting-approval' : 'pending',
        approvalRequirement: policy.approvalRequirement,
        requiredCapability: policy.requiredCapability,
        risk: policy.risk,
        expectedOutput: policy.expectedOutput,
        evidenceRequirement: policy.evidenceRequirement,
        agentId: policy.assignee === 'agent' || policy.assignee === 'agent-team' ? agent.id : undefined,
      };
    }),
  };
}

export function createWorkflowStepCommandEvent(run: WorkflowRun, stepId: string, agent: AgentDescriptor): MissionControlEvent | null {
  const step = run.steps.find((item) => item.id === stepId);
  if (!step || step.approvalRequirement !== 'command') return null;

  const timestamp = new Date().toISOString();
  const commandId = `workflow-command-${run.id}-${step.id}`;
  const commandProfile = getWorkflowCommandProfile(run, agent);
  const risk = step.risk ?? commandProfile.risk;

  return {
    type: 'command',
    command: {
      id: commandId,
      title: step.title,
      summary: `Runbook step from ${run.workflowName}: ${step.title}`,
      source: 'workflow-runbook',
      goalId: run.goalId,
      evidenceIds: run.evidenceIds,
      agent: {
        agentId: agent.id,
        agentName: agent.name,
        profile: agent.profile,
      },
      reasoning: `${agent.name} needs approval before continuing this ${commandProfile.systemLabel} workflow step. Required capability: ${step.requiredCapability ?? 'workflow-control'}.`,
      expectedResult: step.expectedOutput ?? `The workflow run advances after Command Inbox approves this ${commandProfile.systemLabel} step.`,
      scope: commandProfile.scope,
      risk,
      status: 'pending',
      requestedAt: timestamp,
      execution: {
        status: 'not-started',
        result: 'Waiting in Command Inbox before this workflow step can continue.',
        rollbackAvailable: risk === 'safe',
      },
      workflow: {
        runId: run.id,
        stepId: step.id,
        workflowName: run.workflowName,
      },
      auditTrail: [
        {
          id: `audit-${commandId}-proposed`,
          type: 'proposed',
          actor: 'workflow-runbook',
          timestamp,
          detail: `${agent.name} staged workflow step "${step.title}" for approval.`,
        },
      ],
    },
  };
}

export function markWorkflowRunStepCompleted(run: WorkflowRun, stepId: string, actor = 'user'): WorkflowRun {
  const timestamp = new Date().toISOString();
  const step = run.steps.find((item) => item.id === stepId);
  if (!step) return run;

  const steps = run.steps.map((item) => (item.id === stepId ? { ...item, status: 'completed' as const } : item));
  return {
    ...run,
    steps,
    status: getRunStatusFromSteps(steps),
    updatedAt: timestamp,
    auditTrail: capAuditTrail([...run.auditTrail, createWorkflowRunAudit('step-completed', actor, `Step completed: ${step.title}`, timestamp)]),
  };
}

export function blockWorkflowRunStep(run: WorkflowRun, stepId: string, actor = 'user'): WorkflowRun {
  const timestamp = new Date().toISOString();
  const step = run.steps.find((item) => item.id === stepId);
  if (!step) return run;

  const steps = run.steps.map((item) => (item.id === stepId ? { ...item, status: 'blocked' as const } : item));
  return {
    ...run,
    steps,
    status: 'blocked',
    updatedAt: timestamp,
    auditTrail: capAuditTrail([...run.auditTrail, createWorkflowRunAudit('step-blocked', actor, `Step blocked: ${step.title}`, timestamp)]),
  };
}

export function addWorkflowRunStepNote(run: WorkflowRun, stepId: string, note: string, actor = 'user'): WorkflowRun {
  const trimmed = note.trim();
  if (!trimmed) return run;

  const timestamp = new Date().toISOString();
  const step = run.steps.find((item) => item.id === stepId);
  if (!step) return run;

  return {
    ...run,
    steps: run.steps.map((item) => (item.id === stepId ? { ...item, note: trimmed } : item)),
    updatedAt: timestamp,
    auditTrail: capAuditTrail([...run.auditTrail, createWorkflowRunAudit('step-note', actor, `Note on "${step.title}": ${trimmed}`, timestamp)]),
  };
}

export function markWorkflowRunApprovalStaged(run: WorkflowRun, stepId: string, commandId: string): WorkflowRun {
  const timestamp = new Date().toISOString();
  const step = run.steps.find((item) => item.id === stepId);
  if (!step) return run;

  const steps = run.steps.map((item) =>
    item.id === stepId ? { ...item, status: 'waiting-approval' as const, commandId } : item,
  );
  return {
    ...run,
    steps,
    status: 'waiting-approval',
    updatedAt: timestamp,
    auditTrail: capAuditTrail([...run.auditTrail, createWorkflowRunAudit('approval-staged', 'workflow-runbook', `Approval staged for "${step.title}".`, timestamp)]),
  };
}

export function markWorkflowRunAgentRequested(run: WorkflowRun, stepId: string, actor = 'workflow'): WorkflowRun {
  const timestamp = new Date().toISOString();
  const step = run.steps.find((item) => item.id === stepId);
  if (!step) return run;

  const steps = run.steps.map((item) => (item.id === stepId ? { ...item, status: 'running' as const } : item));
  return {
    ...run,
    steps,
    status: getRunStatusFromSteps(steps),
    updatedAt: timestamp,
    auditTrail: capAuditTrail([...run.auditTrail, createWorkflowRunAudit('agent-requested', actor, `Agent asked to work on "${step.title}".`, timestamp)]),
  };
}

function getStepStatusForCommand(command: CommandRequest): WorkflowStepStatus {
  if (command.status === 'pending') return 'waiting-approval';
  if (command.status === 'queued' || command.status === 'running' || command.status === 'approved' || command.status === 'overridden') {
    return 'running';
  }
  if (command.status === 'succeeded') return 'completed';
  if (command.status === 'failed') return 'failed';
  return 'blocked';
}

export function syncWorkflowRunWithCommands(run: WorkflowRun, commands: CommandRequest[]): WorkflowRun {
  const commandsByStep = new Map(
    commands
      .filter((command) => command.workflow?.runId === run.id)
      .map((command) => [command.workflow?.stepId, command] as const),
  );

  const steps = run.steps.map((step) => {
    const command = commandsByStep.get(step.id);
    if (command) {
      return {
        ...step,
        commandId: command.id,
        status: getStepStatusForCommand(command),
      };
    }

    return step;
  });

  const status = getRunStatusFromSteps(steps);
  const changed = steps.some((step, index) => step.status !== run.steps[index]?.status || step.commandId !== run.steps[index]?.commandId);

  return {
    ...run,
    steps,
    status,
    updatedAt: new Date().toISOString(),
    auditTrail: changed
      ? capAuditTrail([...run.auditTrail, createWorkflowRunAudit('command-synced', 'command-inbox', 'Workflow run synced from Command Inbox command status.')])
      : run.auditTrail,
  };
}
