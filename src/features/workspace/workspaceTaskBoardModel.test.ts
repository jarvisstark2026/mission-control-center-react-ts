import { describe, expect, it } from 'vitest';

import {
  createLocalTask,
  createWorkflowDraftFromTask,
  groupLocalTasksByLane,
  moveLocalTask,
  removeLocalTask,
  updateLocalTask,
} from './workspaceTaskBoardModel';

describe('workspaceTaskBoardModel', () => {
  const now = '2026-05-23T10:00:00.000Z';

  it('creates local task cards with a fixed lane state', () => {
    const task = createLocalTask({ title: 'Review proof', note: 'attach evidence', status: 'next' }, now);

    expect(task).toMatchObject({
      title: 'Review proof',
      note: 'attach evidence',
      status: 'next',
      createdAt: now,
      updatedAt: now,
    });
  });

  it('groups tasks by the shared lane model', () => {
    const tasks = [
      createLocalTask({ title: 'Inbox task', status: 'inbox' }, now),
      createLocalTask({ title: 'Blocked task', status: 'blocked' }, now),
    ];

    const groups = groupLocalTasksByLane(tasks);

    expect(groups.map((group) => group.status)).toEqual(['inbox', 'next', 'blocked', 'done']);
    expect(groups.find((group) => group.status === 'blocked')?.tasks[0]?.title).toBe('Blocked task');
  });

  it('moves, updates, removes, and converts task cards', () => {
    const task = createLocalTask({ title: 'Draft plan', note: 'needs runbook' }, now);
    const moved = moveLocalTask([task], task.id, 'blocked', '2026-05-23T11:00:00.000Z');
    const updated = updateLocalTask(moved, task.id, { title: 'Draft runbook', linkedWorkflowTemplateId: 'night-energy-saving' });

    expect(moved[0]).toMatchObject({ status: 'blocked', updatedAt: '2026-05-23T11:00:00.000Z' });
    expect(updated[0]).toMatchObject({ title: 'Draft runbook', linkedWorkflowTemplateId: 'night-energy-saving' });
    expect(createWorkflowDraftFromTask(updated[0])).toMatchObject({
      name: 'Draft runbook workflow',
      templateId: 'night-energy-saving',
      note: 'needs runbook',
    });
    expect(removeLocalTask(updated, task.id)).toEqual([]);
  });
});
