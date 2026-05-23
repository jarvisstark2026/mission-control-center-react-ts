import { describe, expect, it } from 'vitest';

import { createDefaultSheetState, summarizeSheetColumn, updateSheetCell } from './workspaceEvidenceModel';

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
});
