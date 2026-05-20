import { readLocalStorageJson, writeLocalStorageJson } from './browserStorage';

export type WorkflowTemplate = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  skillIds: string[];
};

export type WorkflowSkill = {
  id: string;
  title: string;
  summary: string;
};

export type WorkflowDraft = {
  id: string | null;
  name: string;
  templateId: string;
  note: string;
  skillIds: string[];
  customSteps: string[];
};

export type SavedWorkflow = WorkflowDraft & {
  id: string;
  createdAt: string;
};

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: 'agent-brief',
    title: 'Agent brief',
    summary: 'Turn a request into a focused, reviewable action path.',
    steps: ['Capture the goal', 'Collect constraints', 'Assign the right skills', 'Execute the task', 'Verify and deliver'],
    skillIds: ['discovery', 'planning', 'verification'],
  },
  {
    id: 'workflow-studio',
    title: 'Workflow studio',
    summary: 'Draft reusable workflows with clear handoff steps and output format.',
    steps: ['Name the workflow', 'Choose the library template', 'Attach helper skills', 'Add user steps', 'Export the handout'],
    skillIds: ['authoring', 'visualisation', 'pdf'],
  },
  {
    id: 'skill-pack',
    title: 'Skill pack',
    summary: 'Convert a repeatable pattern into a reusable Hermes skill.',
    steps: ['Inspect the pattern', 'Write the skill rules', 'Add pitfalls', 'Validate the flow', 'Publish the skill'],
    skillIds: ['authoring', 'review', 'publishing'],
  },
];

export const workflowSkills: WorkflowSkill[] = [
  { id: 'discovery', title: 'Discovery', summary: 'Map the goal, audience, and constraints.' },
  { id: 'planning', title: 'Planning', summary: 'Break work into steps that can actually be executed.' },
  { id: 'verification', title: 'Verification', summary: 'Check the output against the intended result.' },
  { id: 'authoring', title: 'Authoring', summary: 'Draft clear instructions and reusable content.' },
  { id: 'visualisation', title: 'Visualisation', summary: 'Show the workflow as a readable node map.' },
  { id: 'pdf', title: 'PDF handout', summary: 'Prepare a print-ready export for sharing.' },
  { id: 'review', title: 'Review', summary: 'Catch edge cases before the workflow is published.' },
  { id: 'publishing', title: 'Publishing', summary: 'Package the workflow for reuse by others.' },
];

export const workflowStudioStorageKey = 'mission-control-center.workflow-studio.v1';

export function getWorkflowTemplate(templateId: string) {
  return workflowTemplates.find((template) => template.id === templateId) ?? workflowTemplates[0];
}

export function createWorkflowDraft(templateId = workflowTemplates[0].id): WorkflowDraft {
  const template = getWorkflowTemplate(templateId);
  return {
    id: null,
    name: `${template.title} workflow`,
    templateId: template.id,
    note: template.summary,
    skillIds: [...template.skillIds],
    customSteps: [],
  };
}

export function createSavedWorkflow(draft: WorkflowDraft): SavedWorkflow {
  const now = new Date().toISOString();
  const id = draft.id ?? `workflow-${Date.now()}`;

  return {
    ...draft,
    id,
    createdAt: now,
  };
}

function createStarterWorkflow(): SavedWorkflow {
  return createSavedWorkflow({
    ...createWorkflowDraft('workflow-studio'),
    name: 'Starter workflow',
    note: 'A first pass through the workflow studio, already less chaotic than most meetings.',
  });
}

export function loadSavedWorkflows(): SavedWorkflow[] {
  const parsed = readLocalStorageJson<SavedWorkflow[]>(workflowStudioStorageKey);
  if (!Array.isArray(parsed)) return [createStarterWorkflow()];

  const savedWorkflows = parsed.filter((item): item is SavedWorkflow => Boolean(item && item.id && item.name && item.templateId));
  return savedWorkflows.length ? savedWorkflows : [createStarterWorkflow()];
}

export function saveSavedWorkflows(workflows: SavedWorkflow[]): boolean {
  return writeLocalStorageJson(workflowStudioStorageKey, workflows);
}

export function getWorkflowSteps(draft: WorkflowDraft) {
  const template = getWorkflowTemplate(draft.templateId);
  return [...template.steps, ...draft.customSteps.filter((step) => Boolean(step.trim()))];
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildWorkflowHandoutHtml(workflow: WorkflowDraft, selectedSkills: WorkflowSkill[]) {
  const template = getWorkflowTemplate(workflow.templateId);
  const steps = getWorkflowSteps(workflow);
  const svgWidth = Math.max(860, steps.length * 220);
  const nodes = steps
    .map((step, index) => {
      const x = 120 + index * 220;
      const fill = index === 0 ? '#77d1ff' : index === steps.length - 1 ? '#b4ffc2' : '#dbe7ff';
      return `
        <g>
          <circle cx="${x}" cy="120" r="34" fill="${fill}" fill-opacity="0.22" stroke="${fill}" stroke-opacity="0.85" stroke-width="2" />
          <text x="${x}" y="116" text-anchor="middle" fill="#f7fbff" font-size="16" font-family="Inter, system-ui, sans-serif">${index + 1}</text>
          <text x="${x}" y="154" text-anchor="middle" fill="rgba(255,255,255,0.85)" font-size="12" font-family="Inter, system-ui, sans-serif">${escapeHtml(step)}</text>
        </g>`;
    })
    .join('');

  const links = steps
    .slice(0, -1)
    .map((_, index) => {
      const x1 = 154 + index * 220;
      const x2 = 186 + index * 220;
      return `<line x1="${x1}" y1="120" x2="${x2}" y2="120" stroke="rgba(255,255,255,0.5)" stroke-width="2" stroke-linecap="round" />`;
    })
    .join('');

  const skillChips = selectedSkills.map((skill) => `<span class="chip">${escapeHtml(skill.title)}</span>`).join('');
  const stepList = steps.map((step, index) => `<li><strong>Step ${index + 1}.</strong> ${escapeHtml(step)}</li>`).join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(workflow.name)} · handout</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 32px;
        background: #07111d;
        color: #f6fbff;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .page {
        max-width: 1200px;
        margin: 0 auto;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 18px;
        background: linear-gradient(180deg, rgba(9,18,31,0.98), rgba(4,10,18,0.98));
        overflow: hidden;
        box-shadow: 0 28px 100px rgba(0,0,0,0.45);
      }
      .hero {
        padding: 28px 28px 18px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .eyebrow {
        margin: 0 0 8px;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 11px;
        color: rgba(255,255,255,0.58);
      }
      h1 { margin: 0; font-size: 32px; }
      .summary { margin: 10px 0 0; max-width: 860px; color: rgba(255,255,255,0.74); line-height: 1.6; }
      .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
      .skill-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 10px;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 999px;
        background: rgba(255,255,255,0.05);
        font-size: 12px;
      }
      .grid {
        display: grid;
        grid-template-columns: 1.3fr 0.95fr;
        gap: 0;
      }
      .panel { padding: 24px 28px; }
      .panel + .panel { border-left: 1px solid rgba(255,255,255,0.08); }
      .section-title {
        margin: 0 0 14px;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 11px;
        color: rgba(255,255,255,0.62);
      }
      .workflow-visual {
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px;
        background: rgba(255,255,255,0.03);
        overflow-x: auto;
        padding: 8px 0 16px;
      }
      .workflow-visual svg { min-width: ${svgWidth}px; display: block; }
      .steps {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 10px;
      }
      .steps li {
        padding: 12px 14px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        background: rgba(255,255,255,0.04);
        line-height: 1.5;
      }
      .steps strong { color: #d6efff; }
      .note {
        margin-top: 16px;
        padding: 14px 16px;
        border-left: 3px solid rgba(119,209,255,0.9);
        background: rgba(119,209,255,0.08);
        color: rgba(255,255,255,0.84);
        line-height: 1.6;
      }
      .skill-list {
        display: grid;
        gap: 10px;
      }
      .skill-card {
        padding: 12px 14px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 14px;
        background: rgba(255,255,255,0.035);
      }
      .skill-card strong { display: block; margin-bottom: 4px; }
      .skill-card p { margin: 0; color: rgba(255,255,255,0.68); line-height: 1.5; }
      .footer {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 28px 26px;
        color: rgba(255,255,255,0.55);
        border-top: 1px solid rgba(255,255,255,0.08);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 11px;
      }
      @media print {
        body { padding: 0; background: #fff; color: #111; }
        .page { border: none; border-radius: 0; box-shadow: none; }
        .panel + .panel { border-left: 1px solid #ddd; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <header class="hero">
        <p class="eyebrow">Workflow handout</p>
        <h1>${escapeHtml(workflow.name)}</h1>
        <p class="summary">${escapeHtml(workflow.note || template.summary)}</p>
        <div class="meta">
          <span class="chip">Template: ${escapeHtml(template.title)}</span>
          <span class="chip">Steps: ${steps.length}</span>
          <span class="chip">Skills: ${selectedSkills.length}</span>
          ${skillChips}
        </div>
      </header>
      <section class="grid">
        <div class="panel">
          <p class="section-title">Workflow visualisation</p>
          <div class="workflow-visual">
            <svg viewBox="0 0 ${svgWidth} 220" role="img" aria-label="Workflow visualisation">
              <rect x="0" y="0" width="${svgWidth}" height="220" fill="transparent" />
              ${links}
              ${nodes}
            </svg>
          </div>
          <div class="note">${escapeHtml(template.summary)}</div>
        </div>
        <div class="panel">
          <p class="section-title">Skills and step-by-step instructions</p>
          <div class="skill-list">
            ${selectedSkills
              .map((skill) => `<article class="skill-card"><strong>${escapeHtml(skill.title)}</strong><p>${escapeHtml(skill.summary)}</p></article>`)
              .join('')}
          </div>
          <ol class="steps">${stepList}</ol>
        </div>
      </section>
      <footer class="footer">
        <span>Print or save as PDF from the browser dialog</span>
        <span>Generated by Mission Control Center</span>
      </footer>
    </main>
  </body>
</html>`;
}

export function openWorkflowHandout(workflow: WorkflowDraft) {
  const skills = workflowSkills.filter((skill) => workflow.skillIds.includes(skill.id));
  const popup = window.open('', '_blank', 'popup=yes,width=1180,height=1400');
  if (!popup) return false;

  popup.document.open();
  popup.document.write(buildWorkflowHandoutHtml(workflow, skills));
  popup.document.close();
  popup.focus?.();
  setTimeout(() => {
    popup.print();
  }, 250);
  return true;
}
