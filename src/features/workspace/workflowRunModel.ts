import { createId } from '../../lib/createId';
import type { AgentDescriptor } from '../agent-control';
import type { CommandRequest, MissionControlEvent } from '../mission-control';
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
  agentId?: string;
  commandId?: string;
};

export type WorkflowRun = {
  id: string;
  workflowId: string;
  workflowName: string;
  templateId: string;
  status: 'active' | 'waiting-approval' | 'completed' | 'blocked' | 'failed';
  startedAt: string;
  updatedAt: string;
  steps: WorkflowRunStep[];
};

export function startWorkflowRun(workflow: WorkflowDraft, agent: AgentDescriptor, now = new Date().toISOString()): WorkflowRun {
  const workflowId = workflow.id ?? createId('workflow');
  const template = getWorkflowTemplate(workflow.templateId);
  const steps = getWorkflowSteps(workflow);

  return {
    id: createId('workflow-run'),
    workflowId,
    workflowName: workflow.name.trim() || `${template.title} workflow`,
    templateId: template.id,
    status: 'active',
    startedAt: now,
    updatedAt: now,
    steps: steps.map((step, index) => {
      const isAgentStep = index > 0;
      const needsApproval = isAgentStep && index % 2 === 1;
      return {
        id: `${workflowId}-step-${index + 1}`,
        title: step,
        assignee: isAgentStep ? (index % 3 === 0 ? 'agent-team' : 'agent') : 'user',
        status: index === 0 ? 'active' : needsApproval ? 'waiting-approval' : 'pending',
        approvalRequirement: needsApproval ? 'command' : 'none',
        agentId: isAgentStep ? agent.id : undefined,
      };
    }),
  };
}

export function createWorkflowStepCommandEvent(run: WorkflowRun, stepId: string, agent: AgentDescriptor): MissionControlEvent | null {
  const step = run.steps.find((item) => item.id === stepId);
  if (!step || step.approvalRequirement !== 'command') return null;

  const timestamp = new Date().toISOString();
  const commandId = `workflow-command-${run.id}-${step.id}`;

  return {
    type: 'command',
    command: {
      id: commandId,
      title: step.title,
      summary: `Runbook step from ${run.workflowName}: ${step.title}`,
      source: 'workflow-runbook',
      agent: {
        agentId: agent.id,
        agentName: agent.name,
        profile: agent.profile,
      },
      reasoning: `${agent.name} needs approval before continuing this workflow step.`,
      expectedResult: `The workflow run advances after Command Inbox approves this step.`,
      scope: agent.specialty === 'home' ? 'household' : agent.specialty === 'security' ? 'security' : 'system',
      risk: agent.specialty === 'security' ? 'critical' : 'elevated',
      status: 'pending',
      requestedAt: timestamp,
      execution: {
        status: 'not-started',
        result: 'Waiting in Command Inbox before this workflow step can continue.',
        rollbackAvailable: agent.specialty === 'home',
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

  const steps = run.steps.map((step, index) => {
    const command = commandsByStep.get(step.id);
    if (command) {
      return {
        ...step,
        commandId: command.id,
        status: getStepStatusForCommand(command),
      };
    }

    if (index === 0 && step.status === 'active') {
      return { ...step, status: 'completed' as const };
    }

    return step;
  });

  const status = steps.some((step) => step.status === 'failed')
    ? 'failed'
    : steps.some((step) => step.status === 'blocked')
      ? 'blocked'
      : steps.every((step) => step.status === 'completed')
        ? 'completed'
        : steps.some((step) => step.status === 'waiting-approval')
          ? 'waiting-approval'
          : 'active';

  return {
    ...run,
    steps,
    status,
    updatedAt: new Date().toISOString(),
  };
}
