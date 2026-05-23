import { describe, expect, it } from 'vitest';

import {
  completeScheduleBlock,
  createScheduleBlock,
  filterScheduleBlocks,
  postponeScheduleBlock,
  removeScheduleBlock,
  updateScheduleBlock,
} from './workspaceScheduleModel';

describe('workspaceScheduleModel', () => {
  const now = new Date('2026-05-23T10:00:00.000Z');

  it('creates editable local schedule blocks', () => {
    const block = createScheduleBlock({ time: '09:30', title: 'Build', note: 'local work' }, now);

    expect(block).toMatchObject({
      time: '09:30',
      title: 'Build',
      note: 'local work',
      status: 'today',
      date: '2026-05-23',
    });
  });

  it('filters today, upcoming, and done blocks', () => {
    const today = createScheduleBlock({ time: '09:30', title: 'Today', date: '2026-05-23' }, now);
    const upcoming = createScheduleBlock({ time: '09:30', title: 'Tomorrow', date: '2026-05-24' }, now);
    const done = { ...createScheduleBlock({ time: '11:00', title: 'Done' }, now), status: 'done' as const };

    expect(filterScheduleBlocks([today, upcoming, done], 'today', now).map((block) => block.title)).toEqual(['Today']);
    expect(filterScheduleBlocks([today, upcoming, done], 'upcoming', now).map((block) => block.title)).toEqual(['Tomorrow']);
    expect(filterScheduleBlocks([today, upcoming, done], 'done', now).map((block) => block.title)).toEqual(['Done']);
  });

  it('updates, completes, postpones, and removes schedule blocks', () => {
    const block = createScheduleBlock({ time: '09:30', title: 'Build' }, now);
    const updated = updateScheduleBlock([block], block.id, { title: 'Review', note: 'finish review' }, now);

    expect(updated[0]).toMatchObject({ title: 'Review', note: 'finish review' });
    expect(completeScheduleBlock(updated, block.id)[0]?.status).toBe('done');
    expect(postponeScheduleBlock(updated, block.id, now)[0]).toMatchObject({ date: '2026-05-24', status: 'upcoming' });
    expect(removeScheduleBlock(updated, block.id)).toEqual([]);
  });
});
