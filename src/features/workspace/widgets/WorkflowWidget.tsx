import { useEffect, useState } from 'react';
import { createId } from '../../../lib/createId';
import { WorkspaceButton, WorkspaceCatalogGrid, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';
import { createWorkflowDraft, getWorkflowSteps, getWorkflowTemplate, loadSavedWorkflows, openWorkflowHandout, saveSavedWorkflows, workflowSkills, workflowTemplates, type SavedWorkflow, type WorkflowDraft } from '../workflowStudioModel';

export function WorkflowWidget() {
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>(() => loadSavedWorkflows());
  const [draft, setDraft] = useState<WorkflowDraft>(() => createWorkflowDraft('workflow-studio'));
  const [newStep, setNewStep] = useState('');
  const [status, setStatus] = useState('Ready to build a workflow.');

  useEffect(() => {
    if (!saveSavedWorkflows(savedWorkflows)) {
      setStatus('Workflow library could not be saved locally.');
    }
  }, [savedWorkflows]);

  const template = getWorkflowTemplate(draft.templateId);
  const steps = getWorkflowSteps(draft);
  const selectedSkills = workflowSkills.filter((skill) => draft.skillIds.includes(skill.id));
  const selectedSkillIds = new Set(draft.skillIds);
  const canAddCustomStep = newStep.trim().length > 0;
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
    </WorkspaceContentShell>
  );
}

