import { useMemo, useState } from 'react';

import { WorkspaceButton, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';
import {
  createLocalTask,
  createWorkflowDraftFromTask,
  groupLocalTasksByLane,
  loadLocalTaskBoard,
  moveLocalTask,
  removeLocalTask,
  saveLocalTaskBoard,
  updateLocalTask,
  type LocalTask,
  type LocalTaskStatus,
} from '../workspaceTaskBoardModel';
import type { WorkspaceWidget } from '../workspaceTypes';
import { usePersistentWorkspaceState } from '../usePersistentWorkspaceState';
import { createSavedWorkflow, loadSavedWorkflows, saveSavedWorkflows } from '../workflowStudioModel';

type TaskBoardVariant = 'project' | 'list';

const taskLaneOrder: LocalTaskStatus[] = ['inbox', 'next', 'blocked', 'done'];

function createWorkflowFromTask(task: LocalTask) {
  const draft = createWorkflowDraftFromTask(task);
  const saved = createSavedWorkflow({
    id: null,
    name: draft.name,
    templateId: draft.templateId,
    note: draft.note,
    skillIds: [],
    customSteps: [`Resolve task: ${task.title}`, `Evidence: ${task.note}`],
  });

  saveSavedWorkflows([saved, ...loadSavedWorkflows()]);
  return saved.id;
}

export function TaskBoardWidget({
  variant,
  onLaunchWorkspaceWidget,
}: {
  variant: TaskBoardVariant;
  onLaunchWorkspaceWidget?: (kind: WorkspaceWidget['kind']) => void;
}) {
  const [tasks, setTasks] = usePersistentWorkspaceState(loadLocalTaskBoard, saveLocalTaskBoard);
  const [selectedLane, setSelectedLane] = useState<LocalTaskStatus>('inbox');
  const [draft, setDraft] = useState({ title: '', note: '' });
  const groups = useMemo(() => groupLocalTasksByLane(tasks), [tasks]);
  const activeGroup = groups.find((group) => group.status === selectedLane) ?? groups[0];
  const blockedCount = tasks.filter((task) => task.status === 'blocked').length;
  const nextTask = tasks.find((task) => task.status === 'next') ?? tasks.find((task) => task.status === 'blocked') ?? tasks[0] ?? null;
  const title = variant === 'project' ? 'local project board' : 'local task lanes';

  const createTask = () => {
    if (!draft.title.trim()) return;

    setTasks((current) => [
      createLocalTask({ title: draft.title, note: draft.note, status: selectedLane === 'done' ? 'inbox' : selectedLane }),
      ...current,
    ]);
    setDraft({ title: '', note: '' });
  };

  const moveTask = (taskId: string, status: LocalTaskStatus) => {
    setTasks((current) => moveLocalTask(current, taskId, status));
  };

  const convertTask = (task: LocalTask) => {
    const workflowId = createWorkflowFromTask(task);
    setTasks((current) => updateLocalTask(current, task.id, { linkedWorkflowTemplateId: workflowId }));
    onLaunchWorkspaceWidget?.('flow');
  };

  return (
    <WorkspaceContentShell className={`task-board-surface ${variant === 'project' ? 'project-surface' : 'list-surface'}`}>
      <WorkspaceContentHeader
        eyebrow={variant === 'project' ? 'Project list' : 'List'}
        title={title}
        metaEyebrow="local board"
        meta={`${tasks.length} tasks - ${blockedCount} blocked`}
      />
      <WorkspaceSummaryPanel title={nextTask ? `Next: ${nextTask.title}` : 'No local tasks'}>
        {nextTask ? `${nextTask.status}. ${nextTask.note}` : 'Create a local task and move it through inbox, next, blocked, and done.'}
      </WorkspaceSummaryPanel>

      <WorkspaceSectionFrame className="task-board-editor" eyebrow="new task" title="capture work" meta="browser saved">
        <div className="task-board-form">
          <input
            aria-label="Task title"
            value={draft.title}
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            onKeyDown={(event) => event.key === 'Enter' && createTask()}
            placeholder="Task title"
          />
          <input
            aria-label="Task note"
            value={draft.note}
            onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
            placeholder="Context or blocker"
          />
          <WorkspaceButton onClick={createTask}>Add task</WorkspaceButton>
        </div>
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame className="task-board-section" eyebrow="board" title="task lanes" meta="inbox / next / blocked / done">
        <div className="task-lane-tabs" role="tablist" aria-label="Task lanes">
          {groups.map((group) => (
            <button
              key={group.status}
              type="button"
              className={group.status === selectedLane ? 'is-active' : undefined}
              onClick={() => setSelectedLane(group.status)}
              role="tab"
              aria-selected={group.status === selectedLane}
            >
              <strong>{group.label}</strong>
              <span>{group.tasks.length}</span>
            </button>
          ))}
        </div>

        <div className="task-board-lane" role="list" aria-label={`${activeGroup.label} tasks`}>
          {activeGroup.tasks.length ? activeGroup.tasks.map((task) => (
            <article key={task.id} className="task-card" role="listitem" data-state={task.status}>
              <div className="task-card-main">
                <span>{task.status}</span>
                <strong>{task.title}</strong>
                <p>{task.note}</p>
                {task.linkedWorkflowTemplateId ? <small>Workflow draft: {task.linkedWorkflowTemplateId}</small> : null}
              </div>
              <div className="task-card-controls">
                <label>
                  <span>Move</span>
                  <select
                    aria-label={`Move ${task.title}`}
                    value={task.status}
                    onChange={(event) => moveTask(task.id, event.target.value as LocalTaskStatus)}
                  >
                    {taskLaneOrder.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <WorkspaceButton variant="compact" onClick={() => moveTask(task.id, 'blocked')}>Block</WorkspaceButton>
                <WorkspaceButton variant="compact" onClick={() => moveTask(task.id, 'done')}>Done</WorkspaceButton>
                <WorkspaceButton variant="compact" onClick={() => convertTask(task)}>Convert to workflow</WorkspaceButton>
                <WorkspaceButton variant="destructive" onClick={() => setTasks((current) => removeLocalTask(current, task.id))}>Remove</WorkspaceButton>
              </div>
            </article>
          )) : (
            <div className="task-empty-state">No tasks in {activeGroup.label}. Capture one above or switch lanes.</div>
          )}
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
