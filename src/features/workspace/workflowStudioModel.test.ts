import { describe, expect, it } from 'vitest';

import {
  buildWorkflowHandoutHtml,
  createSavedWorkflow,
  createWorkflowDraft,
  getWorkflowSteps,
  workflowSkills,
} from './workflowStudioModel';

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
});
