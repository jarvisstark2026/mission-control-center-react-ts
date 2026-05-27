import { createId } from '../../lib/createId';
import { readLocalStorageJson, writeLocalStorageJson } from './browserStorage';

export type LocalDocumentState = {
  title: string;
  body: string;
  updatedAt: string;
};

export type LocalSheetState = {
  columns: string[];
  rows: string[][];
  updatedAt: string;
};

export type LocalSlideFrame = {
  id: string;
  title: string;
  body: string;
};

export type LocalSlidesState = {
  frames: LocalSlideFrame[];
  activeFrameId: string;
  updatedAt: string;
};

export const localDocumentStorageKey = 'mission-control-center.local-docs.v1';
export const localSheetStorageKey = 'mission-control-center.local-sheet.v1';
export const localSlidesStorageKey = 'mission-control.local-slides.v1';

export function createDefaultDocumentState(now = new Date().toISOString()): LocalDocumentState {
  return {
    title: 'Mission Control Brief',
    body: 'Local decision note. Nothing leaves the browser.',
    updatedAt: now,
  };
}

export function loadLocalDocumentState(now = new Date().toISOString()) {
  const parsed = readLocalStorageJson<LocalDocumentState>(localDocumentStorageKey);
  if (!parsed?.title || typeof parsed.body !== 'string') return createDefaultDocumentState(now);
  return parsed;
}

export function saveLocalDocumentState(state: LocalDocumentState) {
  return writeLocalStorageJson(localDocumentStorageKey, state);
}

export function createDefaultSheetState(now = new Date().toISOString()): LocalSheetState {
  return {
    columns: ['Metric', 'Q1', 'Q2', 'Q3', 'Q4'],
    rows: [
      ['Revenue', '18.2', '21.5', '24.0', '26.8'],
      ['Costs', '9.1', '9.6', '10.3', '11.4'],
      ['Margin', '50', '55', '57', '58'],
      ['Forecast', '14', '16', '18', '20'],
    ],
    updatedAt: now,
  };
}

export function loadLocalSheetState(now = new Date().toISOString()) {
  const parsed = readLocalStorageJson<LocalSheetState>(localSheetStorageKey);
  if (!Array.isArray(parsed?.columns) || !Array.isArray(parsed?.rows)) return createDefaultSheetState(now);
  return parsed;
}

export function saveLocalSheetState(state: LocalSheetState) {
  return writeLocalStorageJson(localSheetStorageKey, state);
}

export function updateSheetCell(state: LocalSheetState, rowIndex: number, cellIndex: number, value: string, now = new Date().toISOString()): LocalSheetState {
  return {
    ...state,
    rows: state.rows.map((row, index) =>
      index === rowIndex
        ? row.map((cell, columnIndex) => (columnIndex === cellIndex ? value : cell))
        : row,
    ),
    updatedAt: now,
  };
}

export function addSheetRow(state: LocalSheetState, now = new Date().toISOString()): LocalSheetState {
  return {
    ...state,
    rows: [...state.rows, state.columns.map((column, index) => (index === 0 ? `Row ${state.rows.length + 1}` : '0'))],
    updatedAt: now,
  };
}

export function addSheetColumn(state: LocalSheetState, now = new Date().toISOString()): LocalSheetState {
  const columnName = `C${state.columns.length}`;
  return {
    columns: [...state.columns, columnName],
    rows: state.rows.map((row) => [...row, '0']),
    updatedAt: now,
  };
}

function parseNumericCell(value: string) {
  const numeric = Number(value.replace('%', '').trim());
  return Number.isFinite(numeric) ? numeric : null;
}

export function summarizeSheetColumn(state: LocalSheetState, columnIndex: number) {
  const values = state.rows
    .map((row) => parseNumericCell(row[columnIndex] ?? ''))
    .filter((value): value is number => value !== null);

  const sum = Number(values.reduce((total, value) => total + value, 0).toFixed(1));
  const average = values.length ? Number((sum / values.length).toFixed(1)) : 0;

  return {
    count: values.length,
    sum,
    average,
  };
}

export function createDefaultSlidesState(now = new Date().toISOString()): LocalSlidesState {
  const frames = [
    {
      id: 'slide-vision',
      title: 'Vision',
      body: 'Mission Control keeps goals, evidence, agents, and approvals in one workspace.',
    },
    {
      id: 'slide-workflow',
      title: 'Workflow',
      body: 'Agent proposals become Command Inbox decisions before anything can run.',
    },
    {
      id: 'slide-launch',
      title: 'Launch',
      body: 'Local widgets stay useful while bridge and backend integrations mature.',
    },
  ];

  return {
    frames,
    activeFrameId: frames[0].id,
    updatedAt: now,
  };
}

function normalizeSlideFrame(value: unknown): LocalSlideFrame | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.title !== 'string' || typeof record.body !== 'string') return null;
  return {
    id: typeof record.id === 'string' && record.id ? record.id : createId('slide'),
    title: record.title.trim() || 'Untitled frame',
    body: record.body,
  };
}

export function loadLocalSlidesState(now = new Date().toISOString()) {
  const parsed = readLocalStorageJson<LocalSlidesState>(localSlidesStorageKey);
  const frames = Array.isArray(parsed?.frames) ? parsed.frames.map(normalizeSlideFrame).filter((frame): frame is LocalSlideFrame => frame !== null) : [];
  if (!frames.length) return createDefaultSlidesState(now);
  const activeFrameId = typeof parsed?.activeFrameId === 'string' ? parsed.activeFrameId : frames[0].id;

  return {
    frames,
    activeFrameId: frames.some((frame) => frame.id === activeFrameId) ? activeFrameId : frames[0].id,
    updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : now,
  };
}

export function saveLocalSlidesState(state: LocalSlidesState) {
  return writeLocalStorageJson(localSlidesStorageKey, state);
}

export function updateSlideFrame(state: LocalSlidesState, frameId: string, updates: Partial<Pick<LocalSlideFrame, 'title' | 'body'>>, now = new Date().toISOString()): LocalSlidesState {
  return {
    ...state,
    frames: state.frames.map((frame) => (frame.id === frameId ? { ...frame, ...updates } : frame)),
    updatedAt: now,
  };
}

export function addSlideFrame(state: LocalSlidesState, now = new Date().toISOString()): LocalSlidesState {
  const frame = {
    id: createId('slide'),
    title: `Frame ${state.frames.length + 1}`,
    body: 'Add the decision, evidence, or operator note for this frame.',
  };

  return {
    frames: [...state.frames, frame],
    activeFrameId: frame.id,
    updatedAt: now,
  };
}

export function removeSlideFrame(state: LocalSlidesState, frameId: string, now = new Date().toISOString()): LocalSlidesState {
  if (state.frames.length <= 1) return state;
  const frames = state.frames.filter((frame) => frame.id !== frameId);
  return {
    frames,
    activeFrameId: state.activeFrameId === frameId ? frames[0].id : state.activeFrameId,
    updatedAt: now,
  };
}

export function selectSlideFrame(state: LocalSlidesState, frameId: string, now = new Date().toISOString()): LocalSlidesState {
  if (!state.frames.some((frame) => frame.id === frameId)) return state;
  return {
    ...state,
    activeFrameId: frameId,
    updatedAt: now,
  };
}
