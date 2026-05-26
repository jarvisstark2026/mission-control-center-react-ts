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

export const localDocumentStorageKey = 'mission-control-center.local-docs.v1';
export const localSheetStorageKey = 'mission-control-center.local-sheet.v1';

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
