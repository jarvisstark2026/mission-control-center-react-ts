import { describe, expect, it } from 'vitest';

import {
  addSheetColumn,
  addSheetRow,
  addSlideFrame,
  createDefaultSheetState,
  createDefaultSlidesState,
  removeSlideFrame,
  selectSlideFrame,
  summarizeSheetColumn,
  updateSheetCell,
  updateSlideFrame,
} from './workspaceEvidenceModel';

describe('workspaceEvidenceModel', () => {
  it('updates local spreadsheet cells without mutating other rows', () => {
    const state = createDefaultSheetState('2026-05-23T10:00:00.000Z');
    const updated = updateSheetCell(state, 0, 1, '42.5', '2026-05-23T11:00:00.000Z');

    expect(updated.rows[0][1]).toBe('42.5');
    expect(updated.rows[1][1]).toBe(state.rows[1][1]);
    expect(updated.updatedAt).toBe('2026-05-23T11:00:00.000Z');
  });

  it('summarizes numeric spreadsheet columns', () => {
    const state = createDefaultSheetState();

    expect(summarizeSheetColumn(state, 1)).toEqual({
      count: 4,
      sum: 91.3,
      average: 22.8,
    });
  });

  it('adds local spreadsheet rows and columns', () => {
    const withRow = addSheetRow(createDefaultSheetState('2026-05-23T10:00:00.000Z'), '2026-05-23T11:00:00.000Z');
    const withColumn = addSheetColumn(withRow, '2026-05-23T12:00:00.000Z');

    expect(withRow.rows).toHaveLength(5);
    expect(withColumn.columns.at(-1)).toBe('C5');
    expect(withColumn.rows.every((row) => row.length === withColumn.columns.length)).toBe(true);
    expect(withColumn.updatedAt).toBe('2026-05-23T12:00:00.000Z');
  });

  it('edits persisted local slide frames', () => {
    const state = createDefaultSlidesState('2026-05-23T10:00:00.000Z');
    const added = addSlideFrame(state, '2026-05-23T11:00:00.000Z');
    const updated = updateSlideFrame(added, added.activeFrameId, { title: 'Evidence frame', body: 'Decision proof.' }, '2026-05-23T12:00:00.000Z');
    const selected = selectSlideFrame(updated, state.activeFrameId, '2026-05-23T13:00:00.000Z');
    const removed = removeSlideFrame(selected, added.activeFrameId, '2026-05-23T14:00:00.000Z');

    expect(added.frames).toHaveLength(state.frames.length + 1);
    expect(updated.frames.find((frame) => frame.id === added.activeFrameId)?.title).toBe('Evidence frame');
    expect(selected.activeFrameId).toBe(state.activeFrameId);
    expect(removed.frames).toHaveLength(state.frames.length);
  });
});
