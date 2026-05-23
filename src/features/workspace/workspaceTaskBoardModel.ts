import { createId } from '../../lib/createId';
import { readLocalStorageJson, writeLocalStorageJson } from './browserStorage';

export type LocalTaskStatus = 'inbox' | 'next' | 'blocked' | 'done';

export type LocalTask = {
  id: string;
  title: string;
  note: string;
  status: LocalTaskStatus;
  createdAt: string;
  updatedAt: string;
  linkedWorkflowTemplateId: string | null;
};

export type LocalTaskInput = {
  title: string;
  note?: string;
  status?: LocalTaskStatus;
  linkedWorkflowTemplateId?: string | null;
};

export type LocalTaskLane = {
  status: LocalTaskStatus;
  label: string;
  note: string;
};

export const localTaskBoardStorageKey = 'mission-control-center.local-task-board.v1';

export const localTaskLanes: LocalTaskLane[] = [
  { status: 'inbox', label: 'Inbox', note: 'captured work' },
  { status: 'next', label: 'Next', note: 'ready to execute' },
  { status: 'blocked', label: 'Blocked', note: 'needs decision' },
  { status: 'done', label: 'Done', note: 'closed work' },
];

export function createLocalTask(input: LocalTaskInput, now = new Date().toISOString()): LocalTask {
  return {
    id: createId('task'),
    title: input.title.trim() || 'Untitled task',
    note: input.note?.trim() || 'local task',
    status: input.status ?? 'inbox',
    createdAt: now,
    updatedAt: now,
    linkedWorkflowTemplateId: input.linkedWorkflowTemplateId ?? null,
  };
}

export function createDefaultLocalTasks(now = new Date().toISOString()): LocalTask[] {
  return [
    createLocalTask({ title: 'Review command workflow', note: 'Confirm the next approval surface', status: 'next', linkedWorkflowTemplateId: 'agent-brief' }, now),
    createLocalTask({ title: 'Attach evidence files', note: 'Load local docs or images for decisions', status: 'inbox' }, now),
    createLocalTask({ title: 'Resolve widget permissions', note: 'Waiting for top bar permissions slice', status: 'blocked' }, now),
    createLocalTask({ title: 'Checkpoint Home Systems v3', note: 'Committed and pushed', status: 'done' }, now),
  ];
}

export function groupLocalTasksByLane(tasks: LocalTask[]) {
  return localTaskLanes.map((lane) => ({
    ...lane,
    tasks: tasks.filter((task) => task.status === lane.status),
  }));
}

export function moveLocalTask(tasks: LocalTask[], taskId: string, status: LocalTaskStatus, now = new Date().toISOString()) {
  return tasks.map((task) => (task.id === taskId ? { ...task, status, updatedAt: now } : task));
}

export function updateLocalTask(tasks: LocalTask[], taskId: string, update: Partial<Omit<LocalTask, 'id' | 'createdAt'>>, now = new Date().toISOString()) {
  return tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          ...update,
          title: update.title?.trim() || task.title,
          note: update.note?.trim() ?? task.note,
          updatedAt: now,
        }
      : task,
  );
}

export function removeLocalTask(tasks: LocalTask[], taskId: string) {
  return tasks.filter((task) => task.id !== taskId);
}

export function createWorkflowDraftFromTask(task: LocalTask) {
  return {
    name: `${task.title} workflow`,
    templateId: task.linkedWorkflowTemplateId ?? 'workflow-studio',
    note: task.note,
  };
}

export function loadLocalTaskBoard(now = new Date().toISOString()) {
  const parsed = readLocalStorageJson<LocalTask[]>(localTaskBoardStorageKey);
  if (!Array.isArray(parsed)) return createDefaultLocalTasks(now);

  const tasks = parsed.filter((task): task is LocalTask =>
    Boolean(task && task.id && task.title && task.status && task.createdAt && task.updatedAt),
  );
  return tasks.length ? tasks : createDefaultLocalTasks(now);
}

export function saveLocalTaskBoard(tasks: LocalTask[]) {
  return writeLocalStorageJson(localTaskBoardStorageKey, tasks);
}
