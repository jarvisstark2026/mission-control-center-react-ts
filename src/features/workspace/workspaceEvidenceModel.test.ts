import { describe, expect, it } from 'vitest';

import {
  addSheetColumn,
  addSheetRow,
  addSlideFrame,
  createLocalFileEvidenceInput,
  createRuntimeSnapshotEvidenceInput,
  createUrlEvidenceInput,
  createDefaultSheetState,
  createDefaultSlidesState,
  getEvidenceTypeForLocalFile,
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

  it('builds evidence inputs for URLs, files, and runtime snapshots', () => {
    const imageRecord = {
      id: 'image',
      path: 'panel.png',
      previewKind: 'image' as const,
      file: new File(['image'], 'panel.png', { type: 'image/png' }),
    };
    const pdfRecord = {
      id: 'pdf',
      path: 'brief.pdf',
      previewKind: 'pdf' as const,
      file: new File(['pdf'], 'brief.pdf', { type: 'application/pdf' }),
    };

    expect(getEvidenceTypeForLocalFile(imageRecord)).toBe('image');
    expect(getEvidenceTypeForLocalFile(pdfRecord)).toBe('pdf');
    expect(createLocalFileEvidenceInput(imageRecord, 'file-explorer')).toMatchObject({
      type: 'image',
      title: 'panel.png',
      source: 'file-explorer',
    });
    expect(createUrlEvidenceInput('https://example.com', 'Example', 'url-widget')).toEqual({
      type: 'url',
      title: 'Example',
      source: 'url-widget',
      summary: 'https://example.com',
    });
    expect(createRuntimeSnapshotEvidenceInput('Snapshot', 'overview', 'local status')).toEqual({
      type: 'note',
      title: 'Snapshot',
      source: 'overview',
      summary: 'local status',
    });
  });
});
