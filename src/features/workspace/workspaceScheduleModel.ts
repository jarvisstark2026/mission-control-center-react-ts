import { createId } from '../../lib/createId';
import { readLocalStorageJson, writeLocalStorageJson } from './browserStorage';

export type LocalScheduleStatus = 'today' | 'upcoming' | 'done';

export type LocalScheduleBlock = {
  id: string;
  time: string;
  title: string;
  note: string;
  status: LocalScheduleStatus;
  date: string;
  linkedWorkflowTemplateId: string | null;
};

export type ScheduleBlockInput = {
  time: string;
  title: string;
  note?: string;
  date?: string;
  linkedWorkflowTemplateId?: string | null;
};

export const localScheduleStorageKey = 'mission-control-center.local-schedule.v1';

export function getLocalIsoDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function createScheduleBlock(input: ScheduleBlockInput, now = new Date()): LocalScheduleBlock {
  const date = input.date?.trim() || getLocalIsoDate(now);
  const today = getLocalIsoDate(now);

  return {
    id: createId('schedule'),
    time: input.time.trim() || '09:00',
    title: input.title.trim() || 'Untitled block',
    note: input.note?.trim() || 'local schedule block',
    status: date > today ? 'upcoming' : 'today',
    date,
    linkedWorkflowTemplateId: input.linkedWorkflowTemplateId ?? null,
  };
}

export function createDefaultScheduleBlocks(now = new Date()): LocalScheduleBlock[] {
  const today = getLocalIsoDate(now);

  return [
    createScheduleBlock({ time: '07:30', title: 'Morning shift', note: 'brief / hydrate / review', date: today }, now),
    createScheduleBlock({ time: '12:15', title: 'Project block', note: 'deep work / build', date: today, linkedWorkflowTemplateId: 'workflow-studio' }, now),
    createScheduleBlock({ time: '16:30', title: 'Check-in', note: 'status / approvals', date: today }, now),
    createScheduleBlock({ time: '21:00', title: 'Wrap-up', note: 'handoff / tidy / plan', date: today }, now),
  ];
}

export function sortScheduleBlocks(blocks: LocalScheduleBlock[]) {
  return [...blocks].sort((left, right) => `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`));
}

export function filterScheduleBlocks(blocks: LocalScheduleBlock[], status: LocalScheduleStatus, now = new Date()) {
  const today = getLocalIsoDate(now);

  return sortScheduleBlocks(blocks).filter((block) => {
    if (status === 'done') return block.status === 'done';
    if (status === 'upcoming') return block.status !== 'done' && block.date > today;
    return block.status !== 'done' && block.date <= today;
  });
}

export function updateScheduleBlock(
  blocks: LocalScheduleBlock[],
  blockId: string,
  update: Partial<Omit<LocalScheduleBlock, 'id'>>,
  now = new Date(),
) {
  const today = getLocalIsoDate(now);

  return sortScheduleBlocks(blocks.map((block) => {
    if (block.id !== blockId) return block;
    const date = update.date ?? block.date;
    const status = update.status ?? (date > today ? 'upcoming' : block.status === 'done' ? 'done' : 'today');

    return {
      ...block,
      ...update,
      date,
      status,
      title: update.title?.trim() || block.title,
      time: update.time?.trim() || block.time,
      note: update.note?.trim() ?? block.note,
    };
  }));
}

export function completeScheduleBlock(blocks: LocalScheduleBlock[], blockId: string) {
  return updateScheduleBlock(blocks, blockId, { status: 'done' });
}

export function postponeScheduleBlock(blocks: LocalScheduleBlock[], blockId: string, now = new Date()) {
  const nextDate = new Date(now);
  nextDate.setDate(nextDate.getDate() + 1);
  return updateScheduleBlock(blocks, blockId, { date: getLocalIsoDate(nextDate), status: 'upcoming' }, now);
}

export function removeScheduleBlock(blocks: LocalScheduleBlock[], blockId: string) {
  return blocks.filter((block) => block.id !== blockId);
}

export function loadLocalSchedule(now = new Date()) {
  const parsed = readLocalStorageJson<LocalScheduleBlock[]>(localScheduleStorageKey);
  if (!Array.isArray(parsed)) return createDefaultScheduleBlocks(now);

  const blocks = parsed.filter((block): block is LocalScheduleBlock =>
    Boolean(block && block.id && block.time && block.title && block.date && block.status),
  );
  return blocks.length ? sortScheduleBlocks(blocks) : createDefaultScheduleBlocks(now);
}

export function saveLocalSchedule(blocks: LocalScheduleBlock[]) {
  return writeLocalStorageJson(localScheduleStorageKey, sortScheduleBlocks(blocks));
}
