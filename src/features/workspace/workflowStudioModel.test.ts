import { describe, expect, it } from 'vitest';

import {
  buildWorkflowHandoutHtml,
  createSavedWorkflow,
  createWorkflowDraft,
  getWorkflowSteps,
  workflowTemplates,
  workflowSkills,
} from './workflowStudioModel';
import { createInitialAgentControlState, getAgentDescriptorById } from '../agent-control';
import { createWorkflowStepCommandEvent, startWorkflowRun, syncWorkflowRunWithCommands } from './workflowRunModel';

describe('workflow studio model', () => {
  it('creates saved workflows with generated ids when drafts are new', () => {
    const saved = createSavedWorkflow(createWorkflowDraft('agent-brief'));

    expect(saved.id).toMatch(/^workflow-/);
    expect(saved.createdAt).toEqual(expect.any(String));
  });

  it('combines template and custom steps while ignoring blank custom steps', () => {
    const draft = {
      ...createWorkflowDraft('workflow-studio'),
      customSteps: ['Run checks', '   ', 'Ship summary'],
    };

    expect(getWorkflowSteps(draft).slice(-2)).toEqual(['Run checks', 'Ship summary']);
  });

  it('escapes workflow handout content before writing printable HTML', () => {
    const draft = {
      ...createWorkflowDraft('agent-brief'),
      name: '<script>alert("x")</script>',
      note: 'Use A & B safely',
      customSteps: ['Review <markup>'],
    };

    const html = buildWorkflowHandoutHtml(draft, workflowSkills.slice(0, 1));

    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).toContain('Use A &amp; B safely');
    expect(html).toContain('Review &lt;markup&gt;');
    expect(html).not.toContain('<script>alert');
  });

  it('starts a runbook and creates approval commands for agent-owned steps', () => {
    const agentControl = createInitialAgentControlState();
    const agent = getAgentDescriptorById(agentControl, 'jarvis-workflow');
    const run = startWorkflowRun(createWorkflowDraft('agent-brief'), agent, '2026-05-22T20:00:00.000Z');
    const approvalStep = run.steps.find((step) => step.approvalRequirement === 'command');

    expect(run.steps[0]?.assignee).toBe('user');
    expect(approvalStep?.status).toBe('waiting-approval');

    const event = approvalStep ? createWorkflowStepCommandEvent(run, approvalStep.id, agent) : null;

    expect(event).toMatchObject({
      type: 'command',
      command: {
        source: 'workflow-runbook',
        agent: {
          agentId: 'jarvis-workflow',
        },
        workflow: {
          runId: run.id,
          stepId: approvalStep?.id,
        },
      },
    });
  });

  it('updates workflow run steps from command decisions', () => {
    const agentControl = createInitialAgentControlState();
    const agent = getAgentDescriptorById(agentControl, 'jarvis-workflow');
    const run = startWorkflowRun(createWorkflowDraft('agent-brief'), agent);
    const approvalStep = run.steps.find((step) => step.approvalRequirement === 'command');
    const event = approvalStep ? createWorkflowStepCommandEvent(run, approvalStep.id, agent) : null;

    if (!event || event.type !== 'command' || !approvalStep) {
      throw new Error('Expected workflow command event');
    }

    const synced = syncWorkflowRunWithCommands(run, [
      {
        ...event.command,
        status: 'succeeded',
        execution: {
          ...event.command.execution,
          status: 'succeeded',
          result: 'Workflow step completed.',
        },
      },
    ]);

    expect(synced.steps.find((step) => step.id === approvalStep.id)?.status).toBe('completed');
  });

  it('uses home runbook command profiles for household workflow proposals', () => {
    const agentControl = createInitialAgentControlState();
    const agent = getAgentDescriptorById(agentControl, 'jarvis-workflow');
    const run = startWorkflowRun(createWorkflowDraft('solar-surplus-optimization'), agent);
    const approvalStep = run.steps.find((step) => step.approvalRequirement === 'command');
    const event = approvalStep ? createWorkflowStepCommandEvent(run, approvalStep.id, agent) : null;

    expect(event).toMatchObject({
      type: 'command',
      command: {
        scope: 'household',
        risk: 'safe',
        execution: {
          rollbackAvailable: true,
        },
      },
    });
  });

  it('includes operational runbooks for home, support, and safety workflows', () => {
    expect(workflowTemplates.map((template) => template.id)).toEqual(expect.arrayContaining([
      'solar-surplus-optimization',
      'leave-home-security',
      'night-energy-saving',
      'support-diagnostics',
      'emergency-safety-check',
    ]));
  });
});
