import { useEffect, useState } from 'react';
import { createId } from '../../../lib/createId';
import type { AgentTaskGateway, AgentTaskRequest, AgentTaskScope } from '../../agent-tasking';
import { getAgentDescriptorById, getVisibleAgentDescriptors, type AgentControlState } from '../../agent-control';
import type { MissionControlRuntime } from '../../mission-control';
import type { OperationalOsRuntime } from '../../operational-os';
import type { ShellRole } from '../../shell/roles';
import { StatusSummary, WorkflowStepCard } from '../operationalBlocks';
import { WorkspaceButton, WorkspaceCatalogGrid, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';
import { createWorkflowDraft, getWorkflowSteps, getWorkflowTemplate, loadSavedWorkflows, openWorkflowHandout, saveSavedWorkflows, workflowSkills, workflowTemplates, type SavedWorkflow, type WorkflowDraft } from '../workflowStudioModel';
import {
  addWorkflowRunStepNote,
  attachEvidenceToWorkflowRun,
  blockWorkflowRunStep,
  createWorkflowStepCommandEvent,
  linkWorkflowRunToGoal,
  loadWorkflowRuns,
  markWorkflowRunAgentRequested,
  markWorkflowRunApprovalStaged,
  markWorkflowRunStepCompleted,
  saveWorkflowRuns,
  startWorkflowRun,
  syncWorkflowRunsWithCommands,
  type WorkflowRun,
  type WorkflowRunStep,
} from '../workflowRunModel';

function getWorkflowTaskScope(run: WorkflowRun, agentSpecialty: string): AgentTaskScope {
  if (run.templateId.includes('security') || run.templateId.includes('safety') || agentSpecialty === 'security') return 'security';
  if (run.templateId.includes('energy') || run.templateId.includes('home') || agentSpecialty === 'home') return 'household';
  if (run.templateId.includes('support') || agentSpecialty === 'support') return 'support';
  return 'system';
}

export function WorkflowWidget({
  missionControl,
  agentControl,
  operationalOs,
  taskGateway,
  role,
}: {
  missionControl: MissionControlRuntime;
  agentControl: AgentControlState;
  operationalOs: OperationalOsRuntime;
  taskGateway: AgentTaskGateway;
  role: ShellRole;
}) {
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>(() => loadSavedWorkflows());
  const [draft, setDraft] = useState<WorkflowDraft>(() => createWorkflowDraft('workflow-studio'));
  const [newStep, setNewStep] = useState('');
  const [status, setStatus] = useState('Ready to build a workflow.');
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>(() => loadWorkflowRuns());
  const [activeRunId, setActiveRunId] = useState(() => loadWorkflowRuns()[0]?.id ?? '');
  const [goalId, setGoalId] = useState('');
  const [runEvidenceId, setRunEvidenceId] = useState('');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const visibleAgents = getVisibleAgentDescriptors(agentControl, role);
  const defaultAgent = visibleAgents.find((agent) => agent.specialty === 'workflow') ?? visibleAgents[0] ?? getAgentDescriptorById(agentControl, agentControl.activeAgentId);
  const [selectedAgentId, setSelectedAgentId] = useState(defaultAgent.id);
  const selectedAgent = getAgentDescriptorById(agentControl, selectedAgentId);
  const activeRun = workflowRuns.find((run) => run.id === activeRunId) ?? null;
  const selectedGoal = operationalOs.state.goals.find((goal) => goal.id === goalId) ?? null;
  const attachableEvidence = operationalOs.state.evidence.filter((evidence) => !activeRun?.evidenceIds.includes(evidence.id));

  useEffect(() => {
    if (!saveSavedWorkflows(savedWorkflows)) {
      setStatus('Workflow library could not be saved locally.');
    }
  }, [savedWorkflows]);

  useEffect(() => {
    if (!saveWorkflowRuns(workflowRuns)) {
      setStatus('Workflow runs could not be saved locally.');
    }
  }, [workflowRuns]);

  useEffect(() => {
    setWorkflowRuns((current) => syncWorkflowRunsWithCommands(current, missionControl.state.commands));
  }, [missionControl.state.commands]);

  const template = getWorkflowTemplate(draft.templateId);
  const steps = getWorkflowSteps(draft);
  const selectedSkills = workflowSkills.filter((skill) => draft.skillIds.includes(skill.id));
  const selectedSkillIds = new Set(draft.skillIds);
  const canAddCustomStep = newStep.trim().length > 0;
  const nextActionableStep = activeRun?.steps.find((step) => !['completed', 'blocked', 'failed'].includes(step.status)) ?? null;
  const svgWidth = Math.max(620, steps.length * 170);

  const selectTemplate = (templateId: string) => {
    const nextTemplate = getWorkflowTemplate(templateId);
    setDraft((current) => ({
      ...current,
      templateId: nextTemplate.id,
      name: current.name.trim() ? current.name : `${nextTemplate.title} workflow`,
      note: current.note.trim() ? current.note : nextTemplate.summary,
      skillIds: [...nextTemplate.skillIds],
    }));
    setStatus(`Loaded ${nextTemplate.title} template.`);
  };

  const toggleSkill = (skillId: string) => {
    setDraft((current) => {
      const skillSet = new Set(current.skillIds);
      if (skillSet.has(skillId)) {
        skillSet.delete(skillId);
      } else {
        skillSet.add(skillId);
      }

      return { ...current, skillIds: Array.from(skillSet) };
    });
  };

  const addCustomStep = () => {
    const trimmed = newStep.trim();
    if (!trimmed) return;

    setDraft((current) => ({ ...current, customSteps: [...current.customSteps, trimmed] }));
    setNewStep('');
    setStatus('Custom step added.');
  };

  const removeCustomStep = (stepIndex: number) => {
    const templateStepCount = template.steps.length;
    const customIndex = stepIndex - templateStepCount;
    if (customIndex < 0) return;

    setDraft((current) => ({
      ...current,
      customSteps: current.customSteps.filter((_, index) => index !== customIndex),
    }));
    setStatus('Custom step removed.');
  };

  const startNewWorkflow = () => {
    setDraft(createWorkflowDraft(template.id));
    setNewStep('');
    setStatus(`Started a new ${template.title} workflow.`);
  };

  const startRun = () => {
    const nextRun = startWorkflowRun(draft, selectedAgent, undefined, {
      goalId: selectedGoal?.id,
      evidenceIds: selectedGoal?.evidenceIds ?? [],
    });
    setWorkflowRuns((current) => [nextRun, ...current.filter((run) => run.id !== nextRun.id)].slice(0, 12));
    setActiveRunId(nextRun.id);
    setStatus(`Started runbook for ${nextRun.workflowName}.`);
  };

  const updateActiveRun = (updater: (run: WorkflowRun) => WorkflowRun) => {
    if (!activeRun) return;
    setWorkflowRuns((current) => current.map((run) => (run.id === activeRun.id ? updater(run) : run)));
  };

  const linkActiveRunToSelectedGoal = () => {
    if (!selectedGoal) return;
    updateActiveRun((run) => linkWorkflowRunToGoal(run, selectedGoal.id, selectedGoal.evidenceIds, role));
    setStatus(`Linked active run to ${selectedGoal.title}.`);
  };

  const attachEvidenceToRun = () => {
    if (!runEvidenceId) return;
    updateActiveRun((run) => attachEvidenceToWorkflowRun(run, runEvidenceId, role));
    setRunEvidenceId('');
    setStatus('Evidence attached to active workflow run.');
  };

  const stageWorkflowStep = (stepId: string) => {
    if (!activeRun) return;
    const event = createWorkflowStepCommandEvent(activeRun, stepId, selectedAgent);
    if (!event) return;

    missionControl.ingestEvents([event]);
    if (event.type === 'command') {
      updateActiveRun((run) => markWorkflowRunApprovalStaged(run, stepId, event.command.id));
    }
    setStatus('Workflow step sent to Command Inbox for approval.');
  };

  const completeWorkflowStep = (stepId: string) => {
    updateActiveRun((run) => markWorkflowRunStepCompleted(run, stepId, role));
    setStatus('Workflow step marked done.');
  };

  const blockWorkflowStep = (stepId: string) => {
    updateActiveRun((run) => blockWorkflowRunStep(run, stepId, role));
    setStatus('Workflow step blocked.');
  };

  const addStepNote = (stepId: string) => {
    const note = noteDrafts[stepId] ?? '';
    updateActiveRun((run) => addWorkflowRunStepNote(run, stepId, note, role));
    setNoteDrafts((current) => ({ ...current, [stepId]: '' }));
    setStatus('Workflow note added.');
  };

  const askAgentForStep = async (step: WorkflowRunStep) => {
    if (!activeRun) return;
    const requestedAt = new Date().toISOString();
    const request: AgentTaskRequest = {
      id: createId('agent-task'),
      objective: `Continue workflow "${activeRun.workflowName}" step: ${step.title}. Expected output: ${step.expectedOutput ?? 'return a useful proposal or finding'}.`,
      scope: getWorkflowTaskScope(activeRun, selectedAgent.specialty),
      risk: step.risk ?? 'safe',
      role,
      targetAgentId: step.agentId ?? selectedAgent.id,
      goalId: activeRun.goalId,
      evidenceIds: activeRun.evidenceIds,
      workflowRunId: activeRun.id,
      workflowStepId: step.id,
      source: 'workflow',
      requestedAt,
    };

    try {
      const result = await taskGateway.submitTask(request);
      missionControl.ingestEvents(result.missionControlEvents);
      const commandEvent = result.missionControlEvents.find((event) => (
        event.type === 'command' &&
        event.command.workflow?.runId === activeRun.id &&
        event.command.workflow?.stepId === step.id
      ));
      const fallbackCommandEvent = result.missionControlEvents.find((event) => event.type === 'command');
      updateActiveRun((run) => (
        commandEvent?.type === 'command'
          ? markWorkflowRunApprovalStaged(run, step.id, commandEvent.command.id)
          : fallbackCommandEvent?.type === 'command'
            ? markWorkflowRunApprovalStaged(run, step.id, fallbackCommandEvent.command.id)
          : markWorkflowRunAgentRequested(run, step.id, 'workflow')
      ));
      setStatus(`Asked ${selectedAgent.name} to work on "${step.title}".`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Agent request failed.');
    }
  };

  const saveWorkflow = () => {
    const workflowId = draft.id ?? createId('workflow');
    const existing = savedWorkflows.find((item) => item.id === workflowId);
    const workflowName = draft.name.trim() || `${template.title} workflow`;
    const nextWorkflow: SavedWorkflow = {
      ...draft,
      name: workflowName,
      id: workflowId,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    setSavedWorkflows((current) => [nextWorkflow, ...current.filter((item) => item.id !== workflowId)].slice(0, 12));
    setDraft((current) => ({ ...current, id: workflowId, name: workflowName }));
    setStatus(`Saved ${nextWorkflow.name}.`);
  };

  const loadWorkflow = (workflow: SavedWorkflow) => {
    setDraft({
      id: workflow.id,
      name: workflow.name,
      templateId: workflow.templateId,
      note: workflow.note,
      skillIds: [...workflow.skillIds],
      customSteps: [...workflow.customSteps],
    });
    setNewStep('');
    setStatus(`Loaded ${workflow.name}.`);
  };

  const printWorkflow = () => {
    const printableDraft = { ...draft, name: draft.name.trim() || `${template.title} workflow` };
    const success = openWorkflowHandout(printableDraft);
    setStatus(success ? `Print handout opened for ${printableDraft.name}.` : 'Popup blocked. Allow popups to print or export as PDF.');
  };

  const copySteps = async () => {
    const workflowName = draft.name.trim() || `${template.title} workflow`;
    const instructions = steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
    try {
      await navigator.clipboard.writeText(`${workflowName}\n\n${instructions}`);
      setStatus('Workflow instructions copied to clipboard.');
    } catch {
      setStatus('Clipboard access was unavailable.');
    }
  };

  const diagramNodes = steps.map((step, index) => {
    const x = 90 + index * 150;
    const fill = index === 0 ? 'var(--jarvis-cyan)' : index === steps.length - 1 ? 'var(--jarvis-success)' : 'var(--jarvis-neutral-line)';

    return (
      <g key={`${step}-${index}`}>
        {index > 0 ? <line x1={x - 60} y1={96} x2={x - 30} y2={96} stroke="rgba(255,255,255,0.46)" strokeWidth="2" strokeLinecap="round" /> : null}
        <circle cx={x} cy={96} r="28" fill={fill} fillOpacity="0.22" stroke={fill} strokeOpacity="0.88" strokeWidth="2" />
        <text x={x} y={100} textAnchor="middle" fill="var(--color-text-strong)" fontSize="15" fontFamily="var(--font-family-ui)">
          {index + 1}
        </text>
        <text x={x} y={146} textAnchor="middle" fill="var(--color-text-primary)" fontSize="11" fontFamily="var(--font-family-ui)">
          {step}
        </text>
      </g>
    );
  });

  return (
    <WorkspaceContentShell className="workflow-surface">
      <WorkspaceContentHeader
        className="workflow-head"
        eyebrow="Workflow studio"
        title={draft.name}
        metaEyebrow={template.title}
        meta={`${steps.length} steps - ${selectedSkills.length} skills`}
      />

      <WorkspaceSectionFrame
        className="workflow-runbook-frame"
        eyebrow="runbook"
        title="live workflow bridge"
        meta={activeRun ? activeRun.status : 'not started'}
      >
        <StatusSummary
          label="Current run"
          title={activeRun ? activeRun.workflowName : 'No active run'}
          detail={
            activeRun
              ? 'Agent-owned steps can stage approval requests directly into Command Inbox.'
              : 'Start a run to turn this saved workflow into an agent/user handoff path.'
          }
          meta={selectedAgent.name}
        />
        <div className="workflow-agent-selector" role="group" aria-label="Workflow agent assignment">
          {visibleAgents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              aria-pressed={selectedAgentId === agent.id}
              onClick={() => setSelectedAgentId(agent.id)}
            >
              <span>{agent.specialty}</span>
              <strong>{agent.name}</strong>
            </button>
          ))}
        </div>
        <label className="workflow-field">
          <span>Related goal</span>
          <select value={goalId} onChange={(event) => setGoalId(event.currentTarget.value)} aria-label="Workflow related goal">
            <option value="">No goal link</option>
            {operationalOs.state.goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
        </label>
        {selectedGoal ? (
          <StatusSummary
            label="Goal context"
            title={selectedGoal.title}
            detail={selectedGoal.objective}
            meta={`${selectedGoal.status} / ${selectedGoal.evidenceIds.length} evidence`}
          />
        ) : null}
        {activeRun && selectedGoal && activeRun.goalId !== selectedGoal.id ? (
          <WorkspaceButton variant="secondary" className="workflow-action" onClick={linkActiveRunToSelectedGoal}>
            Link active run to selected goal
          </WorkspaceButton>
        ) : null}
        {activeRun && attachableEvidence.length ? (
          <div className="workflow-step-note-row workflow-evidence-attach-row">
            <select value={runEvidenceId} onChange={(event) => setRunEvidenceId(event.currentTarget.value)} aria-label="Evidence to attach to workflow run">
              <option value="">Attach evidence to run</option>
              {attachableEvidence.map((evidence) => (
                <option key={evidence.id} value={evidence.id}>
                  {evidence.title}
                </option>
              ))}
            </select>
            <WorkspaceButton variant="compact" className="workflow-inline-add" onClick={attachEvidenceToRun} disabled={!runEvidenceId}>
              Attach
            </WorkspaceButton>
          </div>
        ) : null}
        {nextActionableStep ? (
          <StatusSummary
            className="workflow-next-step-summary"
            label="Next step"
            title={nextActionableStep.title}
            detail={nextActionableStep.expectedOutput ?? 'Advance the next runbook handoff.'}
            meta={`${nextActionableStep.status} / ${nextActionableStep.assignee}`}
          />
        ) : null}
        {workflowRuns.length ? (
          <label className="workflow-field">
            <span>Active run</span>
            <select value={activeRunId} onChange={(event) => setActiveRunId(event.currentTarget.value)} aria-label="Active workflow run">
              {workflowRuns.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.workflowName} / {run.status}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <WorkspaceButton className="workflow-action" onClick={startRun}>
          Start runbook
        </WorkspaceButton>
        {activeRun ? (
          <div className="workflow-run-step-list" role="list" aria-label="Active workflow run steps">
            {activeRun.steps.map((step, index) => {
              const stepActions = [
                ...(step.assignee === 'user' && step.status !== 'completed' && step.status !== 'blocked'
                  ? [{ id: 'done', label: 'Mark done', onClick: () => completeWorkflowStep(step.id), variant: 'primary' as const }]
                  : []),
                ...(step.assignee !== 'user' && step.approvalRequirement !== 'command' && step.status !== 'completed' && step.status !== 'blocked'
                  ? [{ id: 'ask-agent', label: 'Ask agent', onClick: () => void askAgentForStep(step), variant: 'secondary' as const }]
                  : []),
                ...(step.approvalRequirement === 'command' && !step.commandId
                  ? [{ id: 'stage', label: 'Stage approval', onClick: () => stageWorkflowStep(step.id), variant: 'secondary' as const }]
                  : []),
                ...(step.status !== 'completed' && step.status !== 'blocked'
                  ? [{ id: 'block', label: 'Block', onClick: () => blockWorkflowStep(step.id), variant: 'destructive' as const }]
                  : []),
              ];

              return (
                <div className="workflow-run-step-item" key={step.id} role="listitem">
                  <WorkflowStepCard
                    index={index + 1}
                    title={step.title}
                    assignee={step.assignee === 'user' ? 'User' : step.assignee === 'agent-team' ? 'Agent team' : selectedAgent.name}
                    status={step.status}
                    approval={
                      step.approvalRequirement === 'command'
                        ? `Command Inbox approval / ${step.requiredCapability ?? 'capability'}`
                        : `${step.requiredCapability ?? 'operator'} / ${step.evidenceRequirement ?? 'evidence optional'}`
                    }
                    actions={stepActions}
                  />
                  <div className="workflow-step-note-row">
                    <input
                      type="text"
                      value={noteDrafts[step.id] ?? ''}
                      onChange={(event) => setNoteDrafts((current) => ({ ...current, [step.id]: event.currentTarget.value }))}
                      placeholder={step.note ? `Note: ${step.note}` : 'Add note for this step'}
                      aria-label={`Note for ${step.title}`}
                    />
                    <WorkspaceButton
                      variant="compact"
                      className="workflow-inline-add"
                      onClick={() => addStepNote(step.id)}
                      disabled={!(noteDrafts[step.id] ?? '').trim()}
                    >
                      Add note
                    </WorkspaceButton>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </WorkspaceSectionFrame>

      <details className="workflow-collapsible-section">
        <summary>
          <span>Design runbook / Library</span>
          <strong>{template.title}</strong>
          <small>{status}</small>
        </summary>
        <WorkspaceSummaryPanel className="workflow-summary" title={template.title}>
          {status}
        </WorkspaceSummaryPanel>

        <WorkspaceSectionFrame className="workflow-actions" eyebrow="workflow controls" meta="save / export / reset">
          <WorkspaceButton className="workflow-action" onClick={saveWorkflow}>
            Save workflow
          </WorkspaceButton>
          <WorkspaceButton className="workflow-action" onClick={printWorkflow}>
            Print / Save PDF
          </WorkspaceButton>
          <WorkspaceButton variant="secondary" className="workflow-action is-muted" onClick={copySteps}>
            Copy steps
          </WorkspaceButton>
          <WorkspaceButton variant="secondary" className="workflow-action is-muted" onClick={startNewWorkflow}>
            New workflow
          </WorkspaceButton>
        </WorkspaceSectionFrame>

        <div className="workflow-layout">
          <WorkspaceSectionFrame className="workflow-column workflow-library" eyebrow="Workflow library" title="templates and skills" meta="starter set">
          <WorkspaceSectionFrame className="workflow-group" eyebrow="Workflow library" title="template catalog" meta="starter templates">
            <WorkspaceCatalogGrid
              className="workflow-template-list"
              variant="market"
              ariaLabel="Workflow templates"
              items={workflowTemplates.map((item) => ({
                id: item.id,
                label: item.title,
                note: item.summary,
                badge: `${item.steps.length} steps`,
                state: `${item.skillIds.length} skills`,
                active: item.id === template.id,
              }))}
              onSelect={(item) => selectTemplate(item.id)}
            />
          </WorkspaceSectionFrame>

          <WorkspaceSectionFrame className="workflow-group" eyebrow="Skill library" title="helper skills" meta="toggle helper skills">
            <WorkspaceCatalogGrid
              className="workflow-skill-list"
              variant="market"
              ariaLabel="Workflow skills"
              items={workflowSkills.map((skill) => {
                const isSelectedSkill = selectedSkillIds.has(skill.id);

                return {
                  id: skill.id,
                  label: skill.title,
                  note: skill.summary,
                  badge: isSelectedSkill ? 'on' : 'off',
                  active: isSelectedSkill,
                };
              })}
              onSelect={(item) => toggleSkill(item.id)}
            />
          </WorkspaceSectionFrame>
          </WorkspaceSectionFrame>

          <WorkspaceSectionFrame className="workflow-column workflow-canvas" eyebrow="Workflow visualisation" title="step map" meta="step by step">
          <div className="workflow-diagram" aria-label="Workflow visualisation">
            <svg viewBox={`0 0 ${svgWidth} 180`} role="img" aria-label="Workflow diagram">
              <rect x="0" y="0" width={svgWidth} height="180" fill="transparent" />
              {diagramNodes}
            </svg>
          </div>

          <ol className="workflow-step-list" aria-label="Workflow instructions">
            {steps.map((step, index) => (
              <li className="workflow-step" key={`${step}-${index}`}>
                <span>Step {index + 1}</span>
                <strong>{step}</strong>
                {index >= template.steps.length ? (
                  <WorkspaceButton variant="compact" className="workflow-step-remove" onClick={() => removeCustomStep(index)}>
                    Remove
                  </WorkspaceButton>
                ) : null}
              </li>
            ))}
          </ol>

          <div className="workflow-status">{status}</div>
          </WorkspaceSectionFrame>

          <WorkspaceSectionFrame className="workflow-column workflow-editor" eyebrow="User workflow" title="edit and save" meta="local draft">
          <WorkspaceSectionFrame className="workflow-group" eyebrow="User workflow" meta="edit and save">
            <label className="workflow-field">
              <span>Workflow name</span>
              <input
                type="text"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Give the workflow a useful name"
              />
            </label>
            <label className="workflow-field">
              <span>Notes</span>
              <textarea
                value={draft.note}
                onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                placeholder="What should the person or agent know before starting?"
                rows={4}
              />
            </label>
            <label className="workflow-field">
              <span>Add step</span>
              <div className="workflow-inline-input">
                <input
                  type="text"
                  value={newStep}
                  onChange={(event) => setNewStep(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && canAddCustomStep && addCustomStep()}
                  placeholder="Add a custom step"
                />
                <WorkspaceButton variant="secondary" className="workflow-inline-add" onClick={addCustomStep} disabled={!canAddCustomStep}>
                  Add
                </WorkspaceButton>
              </div>
            </label>
          </WorkspaceSectionFrame>

          <WorkspaceSectionFrame className="workflow-group" eyebrow="Saved workflows" meta={`${savedWorkflows.length} stored locally`}>
            <WorkspaceCatalogGrid
              className="workflow-saved-list"
              variant="market"
              ariaLabel="Saved workflows"
              items={savedWorkflows.length ? savedWorkflows.map((workflow) => ({
                id: workflow.id,
                label: workflow.name,
                note: getWorkflowTemplate(workflow.templateId).title,
                badge: `${getWorkflowSteps(workflow).length} steps`,
                state: `${workflow.skillIds.length} skills`,
                active: workflow.id === draft.id,
              })) : []}
              onSelect={(item) => {
                const workflow = savedWorkflows.find((entry) => entry.id === item.id);
                if (workflow) loadWorkflow(workflow);
              }}
            />
            {savedWorkflows.length ? null : <div className="workflow-empty">No saved workflows yet. Save one and it will stay available locally.</div>}
          </WorkspaceSectionFrame>
          </WorkspaceSectionFrame>
        </div>
      </details>
    </WorkspaceContentShell>
  );
}

