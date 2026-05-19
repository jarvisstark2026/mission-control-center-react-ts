import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ChangeEvent } from 'react';

import { StatusChip } from '../../components/ui/StatusChip';
import { readShellLocationFromSearch } from '../shell/location';
import type { ShellRole } from '../shell/roles';
import { isWorkspaceWidgetKind, type WorkspaceWidget } from './workspaceTypes';
import { VisualLab } from '../visual-lab/VisualLab';
import './workspace.css';

type LocalPreviewKind = 'image' | 'audio' | 'video' | 'pdf' | 'text' | 'unsupported';

type LocalImageDimensions = {
  width: number;
  height: number;
};

type LocalFileRecord = {
  id: string;
  file: File;
  path: string;
  previewKind: LocalPreviewKind;
  imageDimensions?: LocalImageDimensions | null;
};

type LocalFolderEntry = {
  id: string;
  name: string;
  path: string;
  kind: 'file' | 'directory';
  depth: number;
  file?: File;
};

type FileSystemFileHandleLike = {
  kind: 'file';
  name: string;
  getFile: () => Promise<File>;
};

type FileSystemDirectoryHandleLike = {
  kind: 'directory';
  name: string;
  values: () => AsyncIterableIterator<FileSystemHandleLike>;
};

type FileSystemHandleLike = FileSystemFileHandleLike | FileSystemDirectoryHandleLike;

type ShowDirectoryPickerFn = (options?: { mode?: 'read'; startIn?: string }) => Promise<FileSystemDirectoryHandleLike>;

const localFilesStoreName = 'files';
const localFilesDbName = 'mission-control-center-local-files';

function openLocalFilesDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(localFilesDbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(localFilesStoreName)) {
        db.createObjectStore(localFilesStoreName, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open local files store'));
  });
}

async function readPersistedLocalFiles(): Promise<LocalFileRecord[]> {
  if (typeof window === 'undefined' || !window.indexedDB) return [];
  const db = await openLocalFilesDb();
  try {
    return await new Promise<LocalFileRecord[]>((resolve, reject) => {
      const tx = db.transaction(localFilesStoreName, 'readonly');
      const store = tx.objectStore(localFilesStoreName);
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result as LocalFileRecord[]) ?? []);
      request.onerror = () => reject(request.error ?? new Error('Unable to load local files'));
    });
  } finally {
    db.close();
  }
}

async function writePersistedLocalFiles(records: LocalFileRecord[]): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) return;
  const db = await openLocalFilesDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(localFilesStoreName, 'readwrite');
      const store = tx.objectStore(localFilesStoreName);
      const clear = store.clear();
      clear.onerror = () => reject(clear.error ?? new Error('Unable to clear local files store'));
      clear.onsuccess = () => {
        records.forEach((record) => store.put(record));
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Unable to persist local files'));
      tx.onabort = () => reject(tx.error ?? new Error('Unable to persist local files'));
    });
  } finally {
    db.close();
  }
}

async function clearPersistedLocalFiles(): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) return;
  const db = await openLocalFilesDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(localFilesStoreName, 'readwrite');
      const store = tx.objectStore(localFilesStoreName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Unable to clear local files'));
      tx.onerror = () => reject(tx.error ?? new Error('Unable to clear local files'));
      tx.onabort = () => reject(tx.error ?? new Error('Unable to clear local files'));
    });
  } finally {
    db.close();
  }
}

function getLocalFilePath(file: File): string {
  return file.webkitRelativePath || file.name;
}

function getLocalFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index >= 0 ? fileName.slice(index + 1).toLowerCase() : '';
}

function classifyLocalFile(file: File): LocalPreviewKind {
  const extension = getLocalFileExtension(file.name);
  const type = file.type.toLowerCase();

  if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif', 'svg'].includes(extension)) {
    return 'image';
  }
  if (type.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'oga'].includes(extension)) {
    return 'audio';
  }
  if (type.startsWith('video/') || ['mp4', 'webm', 'mov', 'm4v', 'mkv', 'ogv'].includes(extension)) {
    return 'video';
  }
  if (type === 'application/pdf' || extension === 'pdf') {
    return 'pdf';
  }
  if (
    type.startsWith('text/') ||
    [
      'txt',
      'md',
      'markdown',
      'json',
      'csv',
      'ts',
      'tsx',
      'js',
      'jsx',
      'css',
      'html',
      'xml',
      'yaml',
      'yml',
      'log',
    ].includes(extension)
  ) {
    return 'text';
  }

  return 'unsupported';
}

function createLocalFileRecord(file: File): LocalFileRecord {
  const path = getLocalFilePath(file);
  const fingerprint = `${path}:${file.size}:${file.lastModified}`;

  return {
    id: fingerprint,
    file,
    path,
    previewKind: classifyLocalFile(file),
  };
}

async function measureImageDimensions(file: File): Promise<LocalImageDimensions | null> {
  if (!file.type.startsWith('image/')) return null;

  const objectUrl = URL.createObjectURL(file);
  try {
    const dimensions = await new Promise<LocalImageDimensions>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height });
      image.onerror = () => reject(new Error('Image load failed'));
      image.src = objectUrl;
    });
    return dimensions;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function clampWidgetSize(value: number, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

const generalUseFolderLabel = 'General use';

async function readFolderEntries(
  rootHandle: FileSystemDirectoryHandleLike | null | undefined,
  rootPath = '',
  depth = 0,
  entries: LocalFolderEntry[] = [],
): Promise<LocalFolderEntry[]> {
  if (!rootHandle || typeof rootHandle.values !== 'function') return entries;

  for await (const handle of rootHandle.values()) {
    const path = rootPath ? `${rootPath}/${handle.name}` : handle.name;
    entries.push({
      id: `${depth}:${path}`,
      name: handle.name,
      path,
      kind: handle.kind === 'directory' ? 'directory' : 'file',
      depth,
      ...(handle.kind === 'file' ? { file: await handle.getFile() } : {}),
    });

    if (handle.kind === 'directory' && depth < 3) {
      await readFolderEntries(handle, path, depth + 1, entries);
    }
  }

  return entries;
}

function formatLocalFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type WorkflowTemplate = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  skillIds: string[];
};

type WorkflowSkill = {
  id: string;
  title: string;
  summary: string;
};

type WorkflowDraft = {
  id: string | null;
  name: string;
  templateId: string;
  note: string;
  skillIds: string[];
  customSteps: string[];
};

type SavedWorkflow = WorkflowDraft & {
  id: string;
  createdAt: string;
};

const workflowTemplates: WorkflowTemplate[] = [
  {
    id: 'agent-brief',
    title: 'Agent brief',
    summary: 'Turn a request into a focused, reviewable action path.',
    steps: ['Capture the goal', 'Collect constraints', 'Assign the right skills', 'Execute the task', 'Verify and deliver'],
    skillIds: ['discovery', 'planning', 'verification'],
  },
  {
    id: 'workflow-studio',
    title: 'Workflow studio',
    summary: 'Draft reusable workflows with clear handoff steps and output format.',
    steps: ['Name the workflow', 'Choose the library template', 'Attach helper skills', 'Add user steps', 'Export the handout'],
    skillIds: ['authoring', 'visualisation', 'pdf'],
  },
  {
    id: 'skill-pack',
    title: 'Skill pack',
    summary: 'Convert a repeatable pattern into a reusable Hermes skill.',
    steps: ['Inspect the pattern', 'Write the skill rules', 'Add pitfalls', 'Validate the flow', 'Publish the skill'],
    skillIds: ['authoring', 'review', 'publishing'],
  },
];

const workflowSkills: WorkflowSkill[] = [
  { id: 'discovery', title: 'Discovery', summary: 'Map the goal, audience, and constraints.' },
  { id: 'planning', title: 'Planning', summary: 'Break work into steps that can actually be executed.' },
  { id: 'verification', title: 'Verification', summary: 'Check the output against the intended result.' },
  { id: 'authoring', title: 'Authoring', summary: 'Draft clear instructions and reusable content.' },
  { id: 'visualisation', title: 'Visualisation', summary: 'Show the workflow as a readable node map.' },
  { id: 'pdf', title: 'PDF handout', summary: 'Prepare a print-ready export for sharing.' },
  { id: 'review', title: 'Review', summary: 'Catch edge cases before the workflow is published.' },
  { id: 'publishing', title: 'Publishing', summary: 'Package the workflow for reuse by others.' },
];

const workflowStudioStorageKey = 'mission-control-center.workflow-studio.v1';

function getWorkflowTemplate(templateId: string) {
  return workflowTemplates.find((template) => template.id === templateId) ?? workflowTemplates[0];
}

function createWorkflowDraft(templateId = workflowTemplates[0].id): WorkflowDraft {
  const template = getWorkflowTemplate(templateId);
  return {
    id: null,
    name: `${template.title} workflow`,
    templateId: template.id,
    note: template.summary,
    skillIds: [...template.skillIds],
    customSteps: [],
  };
}

function createSavedWorkflow(draft: WorkflowDraft): SavedWorkflow {
  const now = new Date().toISOString();
  const id = draft.id ?? `workflow-${Date.now()}`;

  return {
    ...draft,
    id,
    createdAt: now,
  };
}

function createStarterWorkflow(): SavedWorkflow {
  return createSavedWorkflow({
    ...createWorkflowDraft('workflow-studio'),
    name: 'Starter workflow',
    note: 'A first pass through the workflow studio, already less chaotic than most meetings.',
  });
}

function loadSavedWorkflows(): SavedWorkflow[] {
  if (typeof window === 'undefined') return [createStarterWorkflow()];

  try {
    const raw = window.localStorage.getItem(workflowStudioStorageKey);
    if (!raw) return [createStarterWorkflow()];

    const parsed = JSON.parse(raw) as SavedWorkflow[];
    if (!Array.isArray(parsed)) return [createStarterWorkflow()];

    const savedWorkflows = parsed.filter((item): item is SavedWorkflow => Boolean(item && item.id && item.name && item.templateId));
    return savedWorkflows.length ? savedWorkflows : [createStarterWorkflow()];
  } catch {
    return [createStarterWorkflow()];
  }
}

function getWorkflowSteps(draft: WorkflowDraft) {
  const template = getWorkflowTemplate(draft.templateId);
  return [...template.steps, ...draft.customSteps.filter((step) => Boolean(step.trim()))];
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildWorkflowHandoutHtml(workflow: WorkflowDraft, selectedSkills: WorkflowSkill[]) {
  const template = getWorkflowTemplate(workflow.templateId);
  const steps = getWorkflowSteps(workflow);
  const svgWidth = Math.max(860, steps.length * 220);
  const nodes = steps
    .map((step, index) => {
      const x = 120 + index * 220;
      const fill = index === 0 ? '#77d1ff' : index === steps.length - 1 ? '#b4ffc2' : '#dbe7ff';
      return `
        <g>
          <circle cx="${x}" cy="120" r="34" fill="${fill}" fill-opacity="0.22" stroke="${fill}" stroke-opacity="0.85" stroke-width="2" />
          <text x="${x}" y="116" text-anchor="middle" fill="#f7fbff" font-size="16" font-family="Inter, system-ui, sans-serif">${index + 1}</text>
          <text x="${x}" y="154" text-anchor="middle" fill="rgba(255,255,255,0.85)" font-size="12" font-family="Inter, system-ui, sans-serif">${escapeHtml(step)}</text>
        </g>`;
    })
    .join('');

  const links = steps
    .slice(0, -1)
    .map((_, index) => {
      const x1 = 154 + index * 220;
      const x2 = 186 + index * 220;
      return `<line x1="${x1}" y1="120" x2="${x2}" y2="120" stroke="rgba(255,255,255,0.5)" stroke-width="2" stroke-linecap="round" />`;
    })
    .join('');

  const skillChips = selectedSkills.map((skill) => `<span class="chip">${escapeHtml(skill.title)}</span>`).join('');
  const stepList = steps.map((step, index) => `<li><strong>Step ${index + 1}.</strong> ${escapeHtml(step)}</li>`).join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(workflow.name)} · handout</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 32px;
        background: #07111d;
        color: #f6fbff;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .page {
        max-width: 1200px;
        margin: 0 auto;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 18px;
        background: linear-gradient(180deg, rgba(9,18,31,0.98), rgba(4,10,18,0.98));
        overflow: hidden;
        box-shadow: 0 28px 100px rgba(0,0,0,0.45);
      }
      .hero {
        padding: 28px 28px 18px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .eyebrow {
        margin: 0 0 8px;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 11px;
        color: rgba(255,255,255,0.58);
      }
      h1 { margin: 0; font-size: 32px; }
      .summary { margin: 10px 0 0; max-width: 860px; color: rgba(255,255,255,0.74); line-height: 1.6; }
      .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
      .skill-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 10px;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 999px;
        background: rgba(255,255,255,0.05);
        font-size: 12px;
      }
      .grid {
        display: grid;
        grid-template-columns: 1.3fr 0.95fr;
        gap: 0;
      }
      .panel { padding: 24px 28px; }
      .panel + .panel { border-left: 1px solid rgba(255,255,255,0.08); }
      .section-title {
        margin: 0 0 14px;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 11px;
        color: rgba(255,255,255,0.62);
      }
      .workflow-visual {
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px;
        background: rgba(255,255,255,0.03);
        overflow-x: auto;
        padding: 8px 0 16px;
      }
      .workflow-visual svg { min-width: ${svgWidth}px; display: block; }
      .steps {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 10px;
      }
      .steps li {
        padding: 12px 14px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        background: rgba(255,255,255,0.04);
        line-height: 1.5;
      }
      .steps strong { color: #d6efff; }
      .note {
        margin-top: 16px;
        padding: 14px 16px;
        border-left: 3px solid rgba(119,209,255,0.9);
        background: rgba(119,209,255,0.08);
        color: rgba(255,255,255,0.84);
        line-height: 1.6;
      }
      .skill-list {
        display: grid;
        gap: 10px;
      }
      .skill-card {
        padding: 12px 14px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 14px;
        background: rgba(255,255,255,0.035);
      }
      .skill-card strong { display: block; margin-bottom: 4px; }
      .skill-card p { margin: 0; color: rgba(255,255,255,0.68); line-height: 1.5; }
      .footer {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 28px 26px;
        color: rgba(255,255,255,0.55);
        border-top: 1px solid rgba(255,255,255,0.08);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 11px;
      }
      @media print {
        body { padding: 0; background: #fff; color: #111; }
        .page { border: none; border-radius: 0; box-shadow: none; }
        .panel + .panel { border-left: 1px solid #ddd; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <header class="hero">
        <p class="eyebrow">Workflow handout</p>
        <h1>${escapeHtml(workflow.name)}</h1>
        <p class="summary">${escapeHtml(workflow.note || template.summary)}</p>
        <div class="meta">
          <span class="chip">Template: ${escapeHtml(template.title)}</span>
          <span class="chip">Steps: ${steps.length}</span>
          <span class="chip">Skills: ${selectedSkills.length}</span>
          ${skillChips}
        </div>
      </header>
      <section class="grid">
        <div class="panel">
          <p class="section-title">Workflow visualisation</p>
          <div class="workflow-visual">
            <svg viewBox="0 0 ${svgWidth} 220" role="img" aria-label="Workflow visualisation">
              <rect x="0" y="0" width="${svgWidth}" height="220" fill="transparent" />
              ${links}
              ${nodes}
            </svg>
          </div>
          <div class="note">${escapeHtml(template.summary)}</div>
        </div>
        <div class="panel">
          <p class="section-title">Skills and step-by-step instructions</p>
          <div class="skill-list">
            ${selectedSkills
              .map((skill) => `<article class="skill-card"><strong>${escapeHtml(skill.title)}</strong><p>${escapeHtml(skill.summary)}</p></article>`)
              .join('')}
          </div>
          <ol class="steps">${stepList}</ol>
        </div>
      </section>
      <footer class="footer">
        <span>Print or save as PDF from the browser dialog</span>
        <span>Generated by Mission Control Center</span>
      </footer>
    </main>
  </body>
</html>`;
}

function openWorkflowHandout(workflow: WorkflowDraft) {
  const skills = workflowSkills.filter((skill) => workflow.skillIds.includes(skill.id));
  const popup = window.open('', '_blank', 'popup=yes,width=1180,height=1400');
  if (!popup) return false;

  popup.document.open();
  popup.document.write(buildWorkflowHandoutHtml(workflow, skills));
  popup.document.close();
  popup.focus?.();
  setTimeout(() => {
    popup.print();
  }, 250);
  return true;
}

const widgetPresets: WorkspaceWidget[] = [
  {
    id: 'overview',
    kind: 'overview',
    title: 'Command core',
    subtitle: 'open / move / stack',
    x: 44,
    y: 74,
    width: 390,
    height: 248,
    zIndex: 6,
    surfaceAlpha: 0.11,
    lineAlpha: 0.18,
    open: true,
    minWidth: 300,
    minHeight: 180,
    pinned: true,
  },
  {
    id: 'telemetry',
    kind: 'graph',
    title: 'Telemetry',
    subtitle: 'live curves',
    x: 264,
    y: 88,
    width: 350,
    height: 220,
    zIndex: 5,
    surfaceAlpha: 0.085,
    lineAlpha: 0.16,
    open: true,
    minWidth: 280,
    minHeight: 170,
  },
  {
    id: 'market-telemetry',
    kind: 'trading-graph',
    title: 'Trading graph',
    subtitle: 'market curves',
    x: 620,
    y: 90,
    width: 378,
    height: 224,
    zIndex: 5,
    surfaceAlpha: 0.09,
    lineAlpha: 0.17,
    open: true,
    minWidth: 300,
    minHeight: 180,
  },
  {
    id: 'preview',
    kind: '3d',
    title: 'Preview',
    subtitle: 'files / models',
    x: 528,
    y: 66,
    width: 426,
    height: 258,
    zIndex: 4,
    surfaceAlpha: 0.1,
    lineAlpha: 0.16,
    open: true,
    minWidth: 300,
    minHeight: 190,
    previewFileId: null,
  },
  {
    id: 'map',
    kind: 'map',
    title: 'Map / routes',
    subtitle: 'locations / zones',
    x: 246,
    y: 286,
    width: 300,
    height: 218,
    zIndex: 3,
    surfaceAlpha: 0.08,
    lineAlpha: 0.15,
    open: true,
    minWidth: 250,
    minHeight: 170,
  },
  {
    id: 'flow',
    kind: 'flow',
    title: 'Workflows',
    subtitle: 'library / steps / pdf',
    x: 560,
    y: 318,
    width: 680,
    height: 420,
    zIndex: 2,
    surfaceAlpha: 0.075,
    lineAlpha: 0.14,
    open: true,
    minWidth: 320,
    minHeight: 320,
  },
  {
    id: 'news',
    kind: 'news',
    title: 'Markets',
    subtitle: 'watchlist',
    x: 872,
    y: 94,
    width: 274,
    height: 194,
    zIndex: 1,
    surfaceAlpha: 0.078,
    lineAlpha: 0.14,
    open: true,
    minWidth: 240,
    minHeight: 150,
  },
  {
    id: 'schedule',
    kind: 'schedule',
    title: 'Schedule',
    subtitle: 'day / week / next',
    x: 914,
    y: 308,
    width: 292,
    height: 206,
    zIndex: 2,
    surfaceAlpha: 0.08,
    lineAlpha: 0.14,
    open: true,
    minWidth: 280,
    minHeight: 170,
  },
  {
    id: 'launcher',
    kind: 'launcher',
    title: 'App launcher',
    subtitle: 'apps / desktop hooks',
    x: 586,
    y: 530,
    width: 310,
    height: 194,
    zIndex: 3,
    surfaceAlpha: 0.082,
    lineAlpha: 0.15,
    open: true,
    minWidth: 280,
    minHeight: 180,
  },
  {
    id: 'browser',
    kind: 'browser',
    title: 'Browser',
    subtitle: 'pages / tabs',
    x: 616,
    y: 74,
    width: 392,
    height: 292,
    zIndex: 4,
    surfaceAlpha: 0.074,
    lineAlpha: 0.14,
    open: true,
    minWidth: 320,
    minHeight: 220,
  },
  {
    id: 'watch-video',
    kind: 'watch-video',
    title: 'Live TV',
    subtitle: 'channels / streams',
    x: 986,
    y: 536,
    width: 276,
    height: 180,
    zIndex: 2,
    surfaceAlpha: 0.078,
    lineAlpha: 0.14,
    open: true,
    minWidth: 300,
    minHeight: 200,
  },
  {
    id: 'file-explorer',
    kind: 'file-explorer',
    title: 'File explorer',
    subtitle: 'folders / files',
    x: 60,
    y: 330,
    width: 380,
    height: 420,
    zIndex: 3,
    surfaceAlpha: 0.076,
    lineAlpha: 0.14,
    open: true,
    minWidth: 360,
    minHeight: 380,
  },
  {
    id: 'native-app',
    kind: 'native-app',
    title: 'Native app bridge',
    subtitle: 'installed apps / external windows',
    x: 420,
    y: 320,
    width: 392,
    height: 238,
    zIndex: 4,
    surfaceAlpha: 0.08,
    lineAlpha: 0.15,
    open: true,
    minWidth: 320,
    minHeight: 200,
  },
  {
    id: 'window-manager',
    kind: 'window-manager',
    title: 'Registry',
    subtitle: 'connected surfaces / scopes',
    x: 840,
    y: 332,
    width: 344,
    height: 238,
    zIndex: 4,
    surfaceAlpha: 0.08,
    lineAlpha: 0.15,
    open: true,
    minWidth: 300,
    minHeight: 200,
  },
  {
    id: 'sheet',
    kind: 'sheet',
    title: 'Spreadsheet',
    subtitle: 'cells / formulas',
    x: 120,
    y: 772,
    width: 408,
    height: 246,
    zIndex: 2,
    surfaceAlpha: 0.082,
    lineAlpha: 0.15,
    open: true,
    minWidth: 320,
    minHeight: 220,
  },
  {
    id: 'docs',
    kind: 'docs',
    title: 'Docs',
    subtitle: 'writing / outline',
    x: 548,
    y: 786,
    width: 342,
    height: 232,
    zIndex: 2,
    surfaceAlpha: 0.08,
    lineAlpha: 0.14,
    open: true,
    minWidth: 300,
    minHeight: 200,
  },
  {
    id: 'slides',
    kind: 'slides',
    title: 'Presentation',
    subtitle: 'deck / speaker notes',
    x: 912,
    y: 790,
    width: 330,
    height: 230,
    zIndex: 2,
    surfaceAlpha: 0.082,
    lineAlpha: 0.15,
    open: true,
    minWidth: 280,
    minHeight: 200,
  },
  {
    id: 'image',
    kind: 'image',
    title: 'Image preview',
    subtitle: 'preview / annotate',
    x: 1260,
    y: 778,
    width: 286,
    height: 224,
    zIndex: 2,
    surfaceAlpha: 0.08,
    lineAlpha: 0.14,
    open: true,
    minWidth: 240,
    minHeight: 190,
  },
  {
    id: 'pdf',
    kind: 'pdf',
    title: 'PDF',
    subtitle: 'read / scan / print',
    x: 1580,
    y: 782,
    width: 300,
    height: 224,
    zIndex: 2,
    surfaceAlpha: 0.08,
    lineAlpha: 0.14,
    open: true,
    minWidth: 260,
    minHeight: 200,
  },
  {
    id: 'audio',
    kind: 'audio',
    title: 'Audio preview',
    subtitle: 'hold / play / mix',
    x: 60,
    y: 548,
    width: 344,
    height: 194,
    zIndex: 2,
    surfaceAlpha: 0.1,
    lineAlpha: 0.17,
    open: true,
    minWidth: 260,
    minHeight: 170,
  },
  {
    id: 'list',
    kind: 'list',
    title: 'Project list',
    subtitle: 'tasks / backlog',
    x: 418,
    y: 568,
    width: 332,
    height: 174,
    zIndex: 1,
    surfaceAlpha: 0.075,
    lineAlpha: 0.14,
    open: true,
    minWidth: 260,
    minHeight: 150,
  },
];

const defaultOpenKinds = new Set<WorkspaceWidget['kind']>([
  'overview',
  'graph',
  'trading-graph',
  'browser',
  'schedule',
  'launcher',
  'file-explorer',
  'sheet',
]);

const initialWidgetState = widgetPresets.map((widget) => ({
  ...widget,
  open: defaultOpenKinds.has(widget.kind),
}));

const workspaceStorageKey = 'mission-control-center.workspace.layout.v1';

function getCurrentShellRole(): ShellRole {
  if (typeof window === 'undefined') return 'support';

  return readShellLocationFromSearch(window.location.search, 'support').role;
}

function buildPanelWindowUrl(kind: WorkspaceWidget['kind']) {
  const url = new URL(window.location.href);
  url.searchParams.set('role', getCurrentShellRole());
  url.searchParams.set('panel', kind);
  return url;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function loadStoredWidgetState(): WorkspaceWidget[] | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(workspaceStorageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<WorkspaceWidget>[];
    if (!Array.isArray(parsed)) return null;

    const byId = new Map(parsed.filter((item): item is Partial<WorkspaceWidget> & { id: string } => Boolean(item && item.id)).map((item) => [item.id, item]));
    const normalizedPresets = widgetPresets.map((preset) => {
      const stored = byId.get(preset.id);
      if (!stored) return { ...preset, open: defaultOpenKinds.has(preset.kind) };

      const minWidth = clampNumber(typeof stored.minWidth === 'number' ? stored.minWidth : preset.minWidth, preset.minWidth, 120, 1920);
      const minHeight = clampNumber(typeof stored.minHeight === 'number' ? stored.minHeight : preset.minHeight, preset.minHeight, 120, 1080);
      const effectiveMinWidth = preset.kind === 'file-explorer' ? Math.max(minWidth, 360) : minWidth;
      const effectiveMinHeight = preset.kind === 'file-explorer' ? Math.max(minHeight, 380) : minHeight;

      return {
        ...preset,
        ...stored,
        open: typeof stored.open === 'boolean' ? stored.open : defaultOpenKinds.has(preset.kind),
        minWidth: effectiveMinWidth,
        minHeight: effectiveMinHeight,
        width: clampNumber(stored.width, preset.width, effectiveMinWidth, 4096),
        height: clampNumber(stored.height, preset.height, effectiveMinHeight, 4096),
        x: clampNumber(stored.x, preset.x, -8192, 8192),
        y: clampNumber(stored.y, preset.y, -8192, 8192),
        zIndex: clampNumber(stored.zIndex, preset.zIndex, 0, 999),
        surfaceAlpha: clampNumber(stored.surfaceAlpha, preset.surfaceAlpha, 0, 1),
        lineAlpha: clampNumber(stored.lineAlpha, preset.lineAlpha, 0, 1),
      };
    });

    const dynamicWidgets = parsed
      .filter((item): item is Partial<WorkspaceWidget> & { id: string } => Boolean(item && item.id && !widgetPresets.some((preset) => preset.id === item.id) && item.kind && isWorkspaceWidgetKind(item.kind)))
      .map((stored) => {
        const kind = stored.kind as keyof typeof widgetBlueprints;
        const blueprint = widgetBlueprints[kind];
        const minWidth = clampNumber(typeof stored.minWidth === 'number' ? stored.minWidth : blueprint?.minWidth ?? 300, blueprint?.minWidth ?? 300, 120, 1920);
        const minHeight = clampNumber(typeof stored.minHeight === 'number' ? stored.minHeight : blueprint?.minHeight ?? 180, blueprint?.minHeight ?? 180, 120, 1080);
        return {
          ...(blueprint ? { title: blueprint.title, subtitle: blueprint.subtitle, surfaceAlpha: blueprint.surfaceAlpha, lineAlpha: blueprint.lineAlpha } : {}),
          ...stored,
          kind,
          open: typeof stored.open === 'boolean' ? stored.open : true,
          minWidth,
          minHeight,
          width: clampNumber(stored.width, blueprint?.minWidth ?? minWidth, minWidth, 4096),
          height: clampNumber(stored.height, blueprint?.minHeight ?? minHeight, minHeight, 4096),
          x: clampNumber(stored.x, 0, -8192, 8192),
          y: clampNumber(stored.y, 0, -8192, 8192),
          zIndex: clampNumber(stored.zIndex, 1, 0, 999),
          surfaceAlpha: clampNumber(stored.surfaceAlpha, blueprint?.surfaceAlpha ?? 0.08, 0, 1),
          lineAlpha: clampNumber(stored.lineAlpha, blueprint?.lineAlpha ?? 0.14, 0, 1),
        } as WorkspaceWidget;
      });

    return [...normalizedPresets, ...dynamicWidgets];
  } catch {
    return null;
  }
}

const launchableWindowKinds: WorkspaceWidget['kind'][] = [
  'overview',
  'graph',
  'audio',
  'map',
  'diagram',
  'project',
  'news',
  'schedule',
  'launcher',
  'browser',
  'watch-video',
  'file-explorer',
  'window-manager',
  'sheet',
  'docs',
  'slides',
  'trading-graph',
  'image',
  'pdf',
  'video',
  '3d',
  '3d-studio',
  'flow',
  'list',
];

const widgetBlueprints: Record<WorkspaceWidget['kind'], { title: string; subtitle: string; surfaceAlpha: number; lineAlpha: number; minWidth: number; minHeight: number }> = {
  overview: { title: 'Command core', subtitle: 'open / move / stack', surfaceAlpha: 0.11, lineAlpha: 0.18, minWidth: 300, minHeight: 180 },
  graph: { title: 'Telemetry', subtitle: 'live curves', surfaceAlpha: 0.085, lineAlpha: 0.16, minWidth: 280, minHeight: 170 },
  audio: { title: 'Audio preview', subtitle: 'hold / play / mix', surfaceAlpha: 0.1, lineAlpha: 0.17, minWidth: 260, minHeight: 170 },
  map: { title: 'Map / routes', subtitle: 'locations / zones', surfaceAlpha: 0.08, lineAlpha: 0.15, minWidth: 250, minHeight: 170 },
  diagram: { title: 'Diagram preview', subtitle: 'system structure', surfaceAlpha: 0.078, lineAlpha: 0.15, minWidth: 260, minHeight: 170 },
  project: { title: 'Project list', subtitle: 'tasks / backlog', surfaceAlpha: 0.075, lineAlpha: 0.14, minWidth: 260, minHeight: 150 },
  news: { title: 'Markets', subtitle: 'watchlist', surfaceAlpha: 0.078, lineAlpha: 0.14, minWidth: 240, minHeight: 150 },
  schedule: { title: 'Schedule', subtitle: 'day / week / next', surfaceAlpha: 0.08, lineAlpha: 0.14, minWidth: 280, minHeight: 170 },
  launcher: { title: 'App launcher', subtitle: 'apps / desktop hooks', surfaceAlpha: 0.082, lineAlpha: 0.15, minWidth: 280, minHeight: 180 },
  browser: { title: 'Browser', subtitle: 'pages / tabs', surfaceAlpha: 0.074, lineAlpha: 0.14, minWidth: 320, minHeight: 220 },
  'watch-video': { title: 'Live TV', subtitle: 'channels / streams', surfaceAlpha: 0.078, lineAlpha: 0.14, minWidth: 300, minHeight: 200 },
  'file-explorer': { title: 'File explorer', subtitle: 'folders / files', surfaceAlpha: 0.076, lineAlpha: 0.14, minWidth: 300, minHeight: 200 },
  'native-app': { title: 'Native app bridge', subtitle: 'installed apps / external windows', surfaceAlpha: 0.08, lineAlpha: 0.15, minWidth: 320, minHeight: 200 },
  'window-manager': { title: 'Registry', subtitle: 'connected surfaces / scopes', surfaceAlpha: 0.08, lineAlpha: 0.15, minWidth: 300, minHeight: 200 },
  sheet: { title: 'Spreadsheet', subtitle: 'cells / formulas', surfaceAlpha: 0.082, lineAlpha: 0.15, minWidth: 320, minHeight: 220 },
  docs: { title: 'Docs', subtitle: 'writing / outline', surfaceAlpha: 0.08, lineAlpha: 0.14, minWidth: 300, minHeight: 200 },
  slides: { title: 'Presentation', subtitle: 'deck / speaker notes', surfaceAlpha: 0.082, lineAlpha: 0.15, minWidth: 280, minHeight: 200 },
  'trading-graph': { title: 'Trading graph', subtitle: 'market curves', surfaceAlpha: 0.09, lineAlpha: 0.17, minWidth: 300, minHeight: 180 },
  image: { title: 'Image preview', subtitle: 'preview / annotate', surfaceAlpha: 0.08, lineAlpha: 0.14, minWidth: 240, minHeight: 190 },
  pdf: { title: 'PDF', subtitle: 'read / scan / print', surfaceAlpha: 0.08, lineAlpha: 0.14, minWidth: 260, minHeight: 200 },
  video: { title: 'Media frame', subtitle: 'preview panel', surfaceAlpha: 0.082, lineAlpha: 0.14, minWidth: 260, minHeight: 170 },
  '3d': { title: 'Preview', subtitle: 'files / models', surfaceAlpha: 0.1, lineAlpha: 0.16, minWidth: 300, minHeight: 190 },
  '3d-studio': { title: '3D studio', subtitle: 'gesture / simulate / sculpt', surfaceAlpha: 0.11, lineAlpha: 0.18, minWidth: 360, minHeight: 240 },
  flow: { title: 'Workflows', subtitle: 'library / steps / pdf', surfaceAlpha: 0.075, lineAlpha: 0.14, minWidth: 300, minHeight: 220 },
  list: { title: 'List', subtitle: 'inbox / next steps', surfaceAlpha: 0.075, lineAlpha: 0.14, minWidth: 260, minHeight: 150 },
};

function getWidgetLabel(kind: WorkspaceWidget['kind']) {
  return widgetBlueprints[kind].title;
}

function getFocusedWidget(kind: WorkspaceWidget['kind'], width: number, height: number): WorkspaceWidget {
  const blueprint = widgetBlueprints[kind];

  return {
    id: `panel-${kind}`,
    kind,
    title: blueprint.title,
    subtitle: blueprint.subtitle,
    x: 16,
    y: 84,
    width: Math.max(320, width - 32),
    height: Math.max(220, height - 104),
    zIndex: 9,
    surfaceAlpha: blueprint.surfaceAlpha,
    lineAlpha: blueprint.lineAlpha,
    open: true,
    minWidth: blueprint.minWidth,
    minHeight: blueprint.minHeight,
    pinned: true,
  };
}

function createCompactLayout(boundsWidth: number, boundsHeight: number): WorkspaceWidget[] {
  const stackWidth = Math.max(260, Math.min(boundsWidth - 16, 420));
  const totalWidgets = widgetPresets.length;
  const openCount = boundsHeight < 760 ? 2 : 3;
  const topInset = 58;
  const bottomInset = 12;
  const gap = 8;
  const closedHeight = 44;

  const availableHeight = Math.max(0, boundsHeight - topInset - bottomInset - gap * (totalWidgets - 1));
  const openHeightBudget = Math.max(0, availableHeight - closedHeight * (totalWidgets - openCount));
  const openHeight = Math.max(112, Math.min(160, Math.floor(openHeightBudget / openCount)));

  const openHeights =
    openCount === 2
      ? [openHeight + 10, Math.max(112, openHeight - 6)]
      : [openHeight + 12, Math.max(112, openHeight + 2), Math.max(112, openHeight - 10)];

  let nextY = topInset;

  return widgetPresets.map((widget, index) => {
    const isOpen = index < openCount;
    const height = isOpen ? openHeights[index] ?? openHeight : closedHeight;
    const nextWidget = {
      ...widget,
      x: 8,
      y: nextY,
      width: Math.max(widget.minWidth, stackWidth),
      height,
      zIndex: totalWidgets - index,
      open: isOpen,
    };

    nextY += height + gap;
    return nextWidget;
  });
}

type ResizeEdge = 'corner' | 'left' | 'right' | 'bottom';

type ResizeHandleSpec = {
  edge: ResizeEdge;
  className: string;
  gripClassName: string;
  label: string;
  symbol: string;
};

const resizeHandleSpecs: ResizeHandleSpec[] = [
  {
    edge: 'corner',
    className: 'widget-resize-handle-bottom-right',
    gripClassName: 'widget-resize-grip-corner',
    label: 'Resize {title} from the bottom-right corner',
    symbol: '┘',
  },
  {
    edge: 'left',
    className: 'widget-resize-handle-left widget-resize-handle-side',
    gripClassName: 'widget-resize-grip-vertical',
    label: 'Resize {title} from the left edge',
    symbol: '⋮',
  },
  {
    edge: 'right',
    className: 'widget-resize-handle-right widget-resize-handle-side',
    gripClassName: 'widget-resize-grip-vertical',
    label: 'Resize {title} from the right edge',
    symbol: '⋮',
  },
  {
    edge: 'bottom',
    className: 'widget-resize-handle-bottom',
    gripClassName: 'widget-resize-grip-horizontal',
    label: 'Resize {title} from the bottom edge',
    symbol: '⋯',
  },
];

function WidgetResizeHandles({
  widget,
  onStartResize,
  showChrome,
}: {
  widget: WorkspaceWidget;
  onStartResize: (event: ReactPointerEvent<HTMLButtonElement>, widgetId: string, edge: ResizeEdge) => void;
  showChrome: boolean;
}) {
  if (!showChrome || !widget.open) return null;

  return (
    <>
      {resizeHandleSpecs.map((handle) => {
        const label = handle.label.replace('{title}', widget.title);

        return (
          <button
            key={handle.edge}
            type="button"
            className={`widget-resize-handle ${handle.className}`}
            onPointerDown={(event) => {
              event.stopPropagation();
              onStartResize(event, widget.id, handle.edge);
            }}
            aria-label={label}
            title={label}
          >
            <span aria-hidden="true" className={`widget-resize-grip ${handle.gripClassName}`}>
              {handle.symbol}
            </span>
          </button>
        );
      })}
    </>
  );
}

type InteractionState = {
  id: string;
  mode: 'drag' | 'resize';
  edge?: ResizeEdge;
  pointerId: number;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
  startWidth: number;
  startHeight: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function OverviewWidget() {
  return (
    <div className="widget-grid overview-grid">
      <div className="stats-arc" />
      <div className="metric-tile">
        <span>system</span>
        <strong>98%</strong>
      </div>
      <div className="metric-tile">
        <span>devices</span>
        <strong>24</strong>
      </div>
      <div className="metric-tile">
        <span>alerts</span>
        <strong>12</strong>
      </div>
      <div className="metric-tile metric-wide">
        <span>workspace mode</span>
        <strong>drag / resize / stack / fade</strong>
      </div>
    </div>
  );
}

function GraphWidget() {
  return (
    <div className="spark-panel">
      <div className="spark-line spark-a" />
      <div className="spark-line spark-b" />
      <div className="spark-line spark-c" />
      <div className="spark-grid" />
      <div className="spark-axis" />
    </div>
  );
}

type MarketGraph = {
  id: string;
  categoryId: string;
  category: string;
  label: string;
  ticker: string;
  change: string;
  horizon: string;
  note: string;
};

type MarketCategory = {
  id: string;
  label: string;
  summary: string;
  graphs: MarketGraph[];
};

const marketCategories: MarketCategory[] = [
  {
    id: 'equities',
    label: 'Equities',
    summary: 'indices and large caps',
    graphs: [
      { id: 'spx', categoryId: 'equities', category: 'Equities', label: 'S&P 500', ticker: 'SPX', change: '+0.8%', horizon: '1D / 4H', note: 'broad market benchmark and risk appetite' },
      { id: 'ndx', categoryId: 'equities', category: 'Equities', label: 'Nasdaq 100', ticker: 'NDX', change: '+1.4%', horizon: '1D / 1H', note: 'tech-heavy momentum and volatility' },
      { id: 'ukx', categoryId: 'equities', category: 'Equities', label: 'FTSE 100', ticker: 'UKX', change: '+0.3%', horizon: '1D / 1H', note: 'steady large-cap index with defensive tilt' },
    ],
  },
  {
    id: 'crypto',
    label: 'Crypto',
    summary: 'high beta and weekend noise',
    graphs: [
      { id: 'btc', categoryId: 'crypto', category: 'Crypto', label: 'Bitcoin', ticker: 'BTC/USD', change: '+2.1%', horizon: '1D / 30M', note: 'primary crypto risk gauge' },
      { id: 'eth', categoryId: 'crypto', category: 'Crypto', label: 'Ethereum', ticker: 'ETH/USD', change: '+1.6%', horizon: '1D / 30M', note: 'smart contract network and beta proxy' },
      { id: 'sol', categoryId: 'crypto', category: 'Crypto', label: 'Solana', ticker: 'SOL/USD', change: '+3.4%', horizon: '1D / 15M', note: 'fast moving altcoin trend tracker' },
    ],
  },
  {
    id: 'fx',
    label: 'FX',
    summary: 'currency crosses and macro drift',
    graphs: [
      { id: 'eurusd', categoryId: 'fx', category: 'FX', label: 'Euro / Dollar', ticker: 'EUR/USD', change: '-0.2%', horizon: '1D / 1H', note: 'core reserve currency cross' },
      { id: 'gbpusd', categoryId: 'fx', category: 'FX', label: 'Pound / Dollar', ticker: 'GBP/USD', change: '+0.1%', horizon: '1D / 1H', note: 'UK rate sensitivity and risk tone' },
      { id: 'usdjpy', categoryId: 'fx', category: 'FX', label: 'Dollar / Yen', ticker: 'USD/JPY', change: '+0.6%', horizon: '1D / 1H', note: 'carry, intervention risk, and funding stress' },
    ],
  },
  {
    id: 'commodities',
    label: 'Commodities',
    summary: 'energy, metals, and inflation pressure',
    graphs: [
      { id: 'gold', categoryId: 'commodities', category: 'Commodities', label: 'Gold', ticker: 'XAU/USD', change: '+0.4%', horizon: '1D / 4H', note: 'safe haven and real-rate mirror' },
      { id: 'brent', categoryId: 'commodities', category: 'Commodities', label: 'Brent crude', ticker: 'BRENT', change: '-0.7%', horizon: '1D / 1H', note: 'energy pulse and inflation input' },
      { id: 'silver', categoryId: 'commodities', category: 'Commodities', label: 'Silver', ticker: 'XAG/USD', change: '+0.9%', horizon: '1D / 4H', note: 'industrial demand and precious metal mix' },
    ],
  },
];

const marketGraphIndex = new Map(marketCategories.flatMap((category) => category.graphs.map((graph) => [graph.id, graph] as const)));
const defaultMarketGraph = marketCategories[0]?.graphs[0] ?? {
  id: 'spx',
  categoryId: 'equities',
  category: 'Equities',
  label: 'S&P 500',
  ticker: 'SPX',
  change: '+0.8%',
  horizon: '1D / 4H',
  note: 'broad market benchmark and risk appetite',
};

function getMarketGraph(graphId: string) {
  return marketGraphIndex.get(graphId) ?? defaultMarketGraph;
}

function TradingGraphWidget({ graph }: { graph: MarketGraph }) {
  return (
    <div className="trading-graph-surface">
      <div className="trading-graph-header">
        <div>
          <span>market graph</span>
          <strong>{graph.label}</strong>
        </div>
        <div className="trading-graph-header-meta">
          <span>{graph.ticker}</span>
          <small>{graph.category}</small>
        </div>
      </div>
      <div className="trading-graph-summary">
        <div className="trading-graph-stat">
          <span>horizon</span>
          <strong>{graph.horizon}</strong>
        </div>
        <div className="trading-graph-stat">
          <span>signal</span>
          <strong>{graph.change}</strong>
        </div>
        <div className="trading-graph-stat trading-graph-stat-wide">
          <span>notes</span>
          <small>{graph.note}</small>
        </div>
      </div>
      <div className="trading-graph-body">
        <div className="trading-graph-grid" />
        <div className="trading-graph-line trading-a" />
        <div className="trading-graph-line trading-b" />
        <div className="trading-graph-volume" />
      </div>
      <p className="trading-graph-footer">Selecting a market item in the markets widget brings this graph forward and swaps the market context. No ceremony, just the useful bit.</p>
    </div>
  );
}

function MarketsWidget({
  activeGraph,
  onSelectGraph,
}: {
  activeGraph: MarketGraph;
  onSelectGraph: (graph: MarketGraph) => void;
}) {
  return (
    <div className="markets-surface">
      <div className="markets-head">
        <div>
          <span>Markets</span>
          <strong>custom graph library / watchlist</strong>
        </div>
        <div className="markets-head-meta">
          <span>{activeGraph.category}</span>
          <small>{activeGraph.ticker}</small>
        </div>
      </div>
      <div className="markets-summary">
        <strong>{activeGraph.label}</strong>
        <p>{activeGraph.note}</p>
      </div>
      <div className="markets-categories">
        {marketCategories.map((category) => (
          <section className="market-category" key={category.id}>
            <div className="market-category-head">
              <div>
                <span>{category.label}</span>
                <strong>{category.summary}</strong>
              </div>
              <small>{category.graphs.length} graphs</small>
            </div>
            <div className="market-graph-list">
              {category.graphs.map((graph) => {
                const isActive = graph.id === activeGraph.id;
                return (
                  <button
                    key={graph.id}
                    type="button"
                    className={`market-graph-item ${isActive ? 'is-active' : ''}`}
                    onClick={() => onSelectGraph(graph)}
                    aria-pressed={isActive}
                  >
                    <span>{graph.label}</span>
                    <strong>{graph.ticker}</strong>
                    <small>{graph.horizon} · {graph.change}</small>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function SpreadsheetWidget() {
  const columns = ['Q1', 'Q2', 'Q3', 'Q4'];
  const rows = [
    ['Revenue', '18.2', '21.5', '24.0', '26.8'],
    ['Costs', '9.1', '9.6', '10.3', '11.4'],
    ['Margin', '50%', '55%', '57%', '58%'],
    ['Forecast', '14', '16', '18', '20'],
  ];

  return (
    <div className="sheet-surface">
      <div className="sheet-toolbar">
        <span>spreadsheet</span>
        <small>formula bar / grid / cells</small>
      </div>
      <div className="sheet-grid">
        <div className="sheet-corner" />
        {columns.map((col) => (
          <div className="sheet-head" key={col}>{col}</div>
        ))}
        {rows.map((row) => (
          <div className="sheet-row" key={row[0]}>
            <div className="sheet-row-label">{row[0]}</div>
            {row.slice(1).map((cell, index) => (
              <div className="sheet-cell" key={`${row[0]}-${index}`}>{cell}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DocsWidget() {
  const outline = ['Title', 'Abstract', 'Sections', 'Appendix'];
  return (
    <div className="docs-surface">
      <div className="docs-sidebar">
        {outline.map((item) => (
          <div className="docs-outline-item" key={item}>
            <span>{item}</span>
          </div>
        ))}
      </div>
      <div className="docs-page">
        <div className="docs-title">Mission Control Center Brief</div>
        <p>Operational note. This panel behaves like a writing surface: clean sections, careful emphasis, and no unnecessary spectacle.</p>
        <div className="docs-lines">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

function SlidesWidget() {
  const slides = ['Vision', 'Stack', 'Workflows', 'Launch'];
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const activeSlide = slides[activeSlideIndex] ?? slides[0];
  return (
    <div className="slides-surface">
      <div className="slides-stage">
        <div className="slides-canvas">
          <strong>Presentation</strong>
          <p>{activeSlide}</p>
          <small>
            Slide {activeSlideIndex + 1} of {slides.length} · deck / speaker notes / command story
          </small>
        </div>
      </div>
      <div className="slides-strip">
        {slides.map((slide, index) => (
          <button
            key={slide}
            type="button"
            className={`slides-thumb ${index === activeSlideIndex ? 'is-active' : ''}`}
            aria-pressed={index === activeSlideIndex}
            onClick={() => setActiveSlideIndex(index)}
          >
            <span>{index + 1}</span>
            <small>{slide}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function ImageWidget() {
  return (
    <div className="image-surface">
      <div className="image-frame">
        <div className="image-placeholder">
          <span>no asset loaded</span>
          <small>drop / annotate / crop</small>
        </div>
      </div>
      <div className="image-footer">
        <span>image</span>
        <small>preview / annotate / crop</small>
      </div>
    </div>
  );
}

function PdfWidget() {
  return (
    <div className="pdf-surface">
      <div className="pdf-toolbar">
        <span>pdf</span>
        <small>read / search / export</small>
      </div>
      <div className="pdf-page">
        <div className="pdf-ribbon" />
        <div className="pdf-lines">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

function AudioWidget() {
  return (
    <div className="audio-surface">
      <div className="audio-ring audio-ring-a" />
      <div className="audio-ring audio-ring-b" />
      <div className="audio-bars">
        {Array.from({ length: 12 }).map((_, index) => (
          <i key={index} style={{ height: `${36 + ((index * 11) % 54)}%` }} />
        ))}
      </div>
    </div>
  );
}

function MapWidget() {
  return (
    <div className="map-surface">
      <div className="map-grid" />
      <div className="map-route map-route-a" />
      <div className="map-route map-route-b" />
      <div className="map-point map-point-a" />
      <div className="map-point map-point-b" />
      <div className="map-point map-point-c" />
    </div>
  );
}

function DiagramWidget() {
  return (
    <div className="diagram-surface">
      <div className="diagram-node diagram-node-a" />
      <div className="diagram-node diagram-node-b" />
      <div className="diagram-node diagram-node-c" />
      <div className="diagram-link diagram-link-a" />
      <div className="diagram-link diagram-link-b" />
      <div className="diagram-link diagram-link-c" />
    </div>
  );
}

function ProjectWidget() {
  return (
    <div className="project-surface">
      {['layout', 'assets', 'review', 'deploy'].map((label, index) => (
        <div className="project-row" key={label}>
          <span>{label}</span>
          <div className="project-track">
            <i style={{ width: `${50 + index * 10}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function NewsWidget({
  activeGraph,
  onSelectGraph,
}: {
  activeGraph: MarketGraph;
  onSelectGraph: (graph: MarketGraph) => void;
}) {
  return <MarketsWidget activeGraph={activeGraph} onSelectGraph={onSelectGraph} />;
}

function VideoWidget() {
  return (
    <div className="video-surface">
      <div className="video-frame" />
      <div className="video-overlay">preview</div>
    </div>
  );
}

function PreviewWidget({
  file,
  onBrowseFiles,
  onOpenPreview,
}: {
  file: LocalFileRecord | null;
  onBrowseFiles: (files: FileList | File[]) => Promise<LocalFileRecord[]>;
  onOpenPreview: (file: LocalFileRecord) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState('');
  const [status, setStatus] = useState('Select a local file to preview it.');

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      setTextPreview('');
      setStatus('Select a local file to preview it.');
      return undefined;
    }

    const nextUrl = URL.createObjectURL(file.file);
    let cancelled = false;
    setObjectUrl(nextUrl);
    setStatus(`Opening ${file.previewKind} preview…`);
    setTextPreview('');

    if (file.previewKind === 'text') {
      void file.file
        .text()
        .then((content) => {
          if (cancelled) return;
          setTextPreview(content.slice(0, 16000));
          setStatus(`Text preview ready · ${formatLocalFileSize(file.file.size)}`);
        })
        .catch(() => {
          if (cancelled) return;
          setTextPreview('');
          setStatus('Text preview unavailable for this file.');
        });
    } else {
      setStatus(`Ready · ${formatLocalFileSize(file.file.size)}`);
    }

    return () => {
      cancelled = true;
      URL.revokeObjectURL(nextUrl);
    };
  }, [file]);

  const handleBrowsePreviewFiles = () => {
    fileInputRef.current?.click();
  };

  const handlePreviewFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const imported = await onBrowseFiles(selectedFiles);
    imported.forEach((record) => onOpenPreview(record));
    event.target.value = '';
  };

  if (!file) {
    return (
      <div className="preview-surface">
        <div className="preview-orb preview-orb-a" />
        <div className="preview-orb preview-orb-b" />
        <div className="preview-ring" />
        <div className="preview-scan" />
        <div className="preview-empty-state">
          <span>Preview</span>
          <strong>pick a file to inspect</strong>
          <small>images, audio, video, pdf, and text files will render here. The rest will be handled with less glamour, but still gracefully.</small>
          <button type="button" className="preview-empty-button" onClick={handleBrowsePreviewFiles}>
            Preview a file
          </button>
          <input
            ref={fileInputRef}
            className="preview-empty-input"
            type="file"
            multiple
            aria-hidden="true"
            tabIndex={-1}
            onChange={handlePreviewFileChange}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="preview-surface preview-file-surface">
      <div className="preview-file-head">
        <div>
          <span>{file.previewKind}</span>
          <strong>{file.path}</strong>
        </div>
        <div className="preview-file-head-meta">
          <small>{file.file.type || 'unknown type'}</small>
          <small>{formatLocalFileSize(file.file.size)}</small>
        </div>
      </div>

      <div className="preview-file-stage">
        {file.previewKind === 'image' && objectUrl ? (
          <figure className="preview-media preview-media-image">
            <img src={objectUrl} alt={file.path} />
          </figure>
        ) : null}

        {file.previewKind === 'video' && objectUrl ? (
          <div className="preview-media preview-media-video">
            <video controls src={objectUrl} />
          </div>
        ) : null}

        {file.previewKind === 'audio' && objectUrl ? (
          <div className="preview-media preview-media-audio">
            <audio controls src={objectUrl} />
          </div>
        ) : null}

        {file.previewKind === 'pdf' && objectUrl ? (
          <iframe className="preview-media preview-media-pdf" src={objectUrl} title={file.path} />
        ) : null}

        {file.previewKind === 'text' ? (
          <pre className="preview-media preview-media-text">{textPreview || 'Loading text preview…'}</pre>
        ) : null}

        {file.previewKind === 'unsupported' ? (
          <div className="preview-media preview-media-unsupported">
            <strong>No native preview for this file.</strong>
            <p>{status}</p>
            {objectUrl ? (
              <a className="preview-download-link" href={objectUrl} download={file.file.name}>
                Open / download
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="preview-file-foot">
        <span>{status}</span>
        <button type="button" className="preview-empty-button" onClick={handleBrowsePreviewFiles}>
          Preview another file
        </button>
        <input
          ref={fileInputRef}
          className="preview-empty-input"
          type="file"
          multiple
          aria-hidden="true"
          tabIndex={-1}
          onChange={handlePreviewFileChange}
        />
      </div>
    </div>
  );
}

function ModelStudioWidget() {
  const simulationCards = [
    { label: 'Structural integrity', value: '92%', note: 'frame / joints / load paths' },
    { label: 'Bend response', value: '0.18 mm', note: 'deformation under torque' },
    { label: 'Stress hotspots', value: '03', note: 'redline zones and stress peaks' },
    { label: 'Heat map', value: '64°C', note: 'thermal climb under runtime load' },
  ];

  const gestureChips = ['drag', 'pinch', 'orbit', 'slice', 'measure', 'simulate'];

  return (
    <div className="model-studio-surface">
      <div className="model-studio-head">
        <div>
          <span>3D asset authoring</span>
          <strong>sculpt / gesture / simulate</strong>
        </div>
        <div className="model-studio-head-meta">
          <span>real-time engineering</span>
          <small>structures · bending · heat · stress</small>
        </div>
      </div>

      <div className="model-studio-layout">
        <section className="model-studio-canvas">
          <div className="model-studio-grid" />
          <div className="model-studio-rig">
            <div className="model-studio-shell model-studio-shell-a" />
            <div className="model-studio-shell model-studio-shell-b" />
            <div className="model-studio-shell model-studio-shell-c" />
          </div>
          <div className="model-studio-axis model-studio-axis-x" />
          <div className="model-studio-axis model-studio-axis-y" />
          <div className="model-studio-axis model-studio-axis-z" />
          <div className="model-studio-canvas-caption">
            <span>touch / stylus / spatial capture ready</span>
            <small>future support for real 3D-space input can slot in here when the hardware catches up.</small>
          </div>
        </section>

        <aside className="model-studio-panel">
          <div className="model-studio-tools">
            {gestureChips.map((chip) => (
              <button type="button" key={chip} className="model-studio-chip">
                {chip}
              </button>
            ))}
          </div>

          <div className="model-studio-simulations">
            {simulationCards.map((card, index) => (
              <article className="model-studio-sim" key={card.label}>
                <div className="model-studio-sim-head">
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </div>
                <div className="model-studio-sim-bar">
                  <i style={{ width: `${58 - index * 9}%` }} />
                </div>
                <small>{card.note}</small>
              </article>
            ))}
          </div>

          <div className="model-studio-footer">
            <p>Designed as a fluid creation surface first, with engineering-grade simulation bolted on rather than the other way round.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function WorkflowWidget() {
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>(() => loadSavedWorkflows());
  const [draft, setDraft] = useState<WorkflowDraft>(() => createWorkflowDraft('workflow-studio'));
  const [newStep, setNewStep] = useState('');
  const [status, setStatus] = useState('Ready to build a workflow.');

  useEffect(() => {
    try {
      window.localStorage.setItem(workflowStudioStorageKey, JSON.stringify(savedWorkflows));
    } catch {
      setStatus('Workflow library could not be saved locally.');
    }
  }, [savedWorkflows]);

  const template = getWorkflowTemplate(draft.templateId);
  const steps = getWorkflowSteps(draft);
  const selectedSkills = workflowSkills.filter((skill) => draft.skillIds.includes(skill.id));
  const selectedSkillIds = new Set(draft.skillIds);
  const svgWidth = Math.max(620, steps.length * 170);

  const selectTemplate = (templateId: string) => {
    const nextTemplate = getWorkflowTemplate(templateId);
    setDraft((current) => ({
      ...current,
      templateId: nextTemplate.id,
      name: current.name.trim() ? current.name : `${nextTemplate.title} workflow`,
      note: current.note.trim() ? current.note : nextTemplate.summary,
      skillIds: [...nextTemplate.skillIds],
    }));
    setStatus(`Loaded ${nextTemplate.title} template.`);
  };

  const toggleSkill = (skillId: string) => {
    setDraft((current) => {
      const skillSet = new Set(current.skillIds);
      if (skillSet.has(skillId)) {
        skillSet.delete(skillId);
      } else {
        skillSet.add(skillId);
      }

      return { ...current, skillIds: Array.from(skillSet) };
    });
  };

  const addCustomStep = () => {
    const trimmed = newStep.trim();
    if (!trimmed) return;

    setDraft((current) => ({ ...current, customSteps: [...current.customSteps, trimmed] }));
    setNewStep('');
    setStatus('Custom step added.');
  };

  const removeCustomStep = (stepIndex: number) => {
    const templateStepCount = template.steps.length;
    const customIndex = stepIndex - templateStepCount;
    if (customIndex < 0) return;

    setDraft((current) => ({
      ...current,
      customSteps: current.customSteps.filter((_, index) => index !== customIndex),
    }));
    setStatus('Custom step removed.');
  };

  const startNewWorkflow = () => {
    setDraft(createWorkflowDraft(template.id));
    setNewStep('');
    setStatus(`Started a new ${template.title} workflow.`);
  };

  const saveWorkflow = () => {
    const workflowId = draft.id ?? `workflow-${Date.now()}`;
    const existing = savedWorkflows.find((item) => item.id === workflowId);
    const workflowName = draft.name.trim() || `${template.title} workflow`;
    const nextWorkflow: SavedWorkflow = {
      ...draft,
      name: workflowName,
      id: workflowId,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    setSavedWorkflows((current) => [nextWorkflow, ...current.filter((item) => item.id !== workflowId)].slice(0, 12));
    setDraft((current) => ({ ...current, id: workflowId, name: workflowName }));
    setStatus(`Saved ${nextWorkflow.name}.`);
  };

  const loadWorkflow = (workflow: SavedWorkflow) => {
    setDraft({
      id: workflow.id,
      name: workflow.name,
      templateId: workflow.templateId,
      note: workflow.note,
      skillIds: [...workflow.skillIds],
      customSteps: [...workflow.customSteps],
    });
    setNewStep('');
    setStatus(`Loaded ${workflow.name}.`);
  };

  const printWorkflow = () => {
    const printableDraft = { ...draft, name: draft.name.trim() || `${template.title} workflow` };
    const success = openWorkflowHandout(printableDraft);
    setStatus(success ? `Print handout opened for ${printableDraft.name}.` : 'Popup blocked. Allow popups to print or export as PDF.');
  };

  const copySteps = async () => {
    const workflowName = draft.name.trim() || `${template.title} workflow`;
    const instructions = steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
    try {
      await navigator.clipboard.writeText(`${workflowName}\n\n${instructions}`);
      setStatus('Workflow instructions copied to clipboard.');
    } catch {
      setStatus('Clipboard access was unavailable.');
    }
  };

  const diagramNodes = steps.map((step, index) => {
    const x = 90 + index * 150;
    const fill = index === 0 ? '#77d1ff' : index === steps.length - 1 ? '#b4ffc2' : '#dbe7ff';

    return (
      <g key={`${step}-${index}`}>
        {index > 0 ? <line x1={x - 60} y1={96} x2={x - 30} y2={96} stroke="rgba(255,255,255,0.46)" strokeWidth="2" strokeLinecap="round" /> : null}
        <circle cx={x} cy={96} r="28" fill={fill} fillOpacity="0.22" stroke={fill} strokeOpacity="0.88" strokeWidth="2" />
        <text x={x} y={100} textAnchor="middle" fill="#f7fbff" fontSize="15" fontFamily="Inter, system-ui, sans-serif">
          {index + 1}
        </text>
        <text x={x} y={146} textAnchor="middle" fill="rgba(255,255,255,0.86)" fontSize="11" fontFamily="Inter, system-ui, sans-serif">
          {step}
        </text>
      </g>
    );
  });

  return (
    <div className="workflow-surface">
      <div className="workflow-head">
        <div>
          <span>Workflow studio</span>
          <strong>{draft.name}</strong>
        </div>
        <div className="workflow-head-meta">
          <small>{template.title}</small>
          <small>{steps.length} steps · {selectedSkills.length} skills</small>
        </div>
      </div>

      <div className="workflow-actions">
        <button type="button" className="workflow-action" onClick={saveWorkflow}>
          Save workflow
        </button>
        <button type="button" className="workflow-action" onClick={printWorkflow}>
          Print / Save PDF
        </button>
        <button type="button" className="workflow-action is-muted" onClick={copySteps}>
          Copy steps
        </button>
        <button type="button" className="workflow-action is-muted" onClick={startNewWorkflow}>
          New workflow
        </button>
      </div>

      <div className="workflow-layout">
        <aside className="workflow-column workflow-library">
          <div className="workflow-group">
            <div className="workflow-group-head">
              <span>Workflow library</span>
              <small>starter templates</small>
            </div>
            <div className="workflow-template-list">
              {workflowTemplates.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`workflow-card ${item.id === template.id ? 'is-active' : ''}`}
                  onClick={() => selectTemplate(item.id)}
                >
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                  <small>{item.steps.length} steps · {item.skillIds.length} skills</small>
                </button>
              ))}
            </div>
          </div>

          <div className="workflow-group">
            <div className="workflow-group-head">
              <span>Skill library</span>
              <small>toggle helper skills</small>
            </div>
            <div className="workflow-skill-list">
              {workflowSkills.map((skill) => (
                <button
                  type="button"
                  key={skill.id}
                  className={`workflow-skill ${selectedSkillIds.has(skill.id) ? 'is-active' : ''}`}
                  onClick={() => toggleSkill(skill.id)}
                >
                  <strong>{skill.title}</strong>
                  <small>{skill.summary}</small>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="workflow-column workflow-canvas">
          <div className="workflow-group-head">
            <span>Workflow visualisation</span>
            <small>step by step</small>
          </div>
          <div className="workflow-diagram" aria-label="Workflow visualisation">
            <svg viewBox={`0 0 ${svgWidth} 180`} role="img" aria-label="Workflow diagram">
              <rect x="0" y="0" width={svgWidth} height="180" fill="transparent" />
              {diagramNodes}
            </svg>
          </div>

          <ol className="workflow-step-list" aria-label="Workflow instructions">
            {steps.map((step, index) => (
              <li className="workflow-step" key={`${step}-${index}`}>
                <span>Step {index + 1}</span>
                <strong>{step}</strong>
                {index >= template.steps.length ? (
                  <button type="button" className="workflow-step-remove" onClick={() => removeCustomStep(index)}>
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ol>

          <div className="workflow-status">{status}</div>
        </section>

        <aside className="workflow-column workflow-editor">
          <div className="workflow-group">
            <div className="workflow-group-head">
              <span>User workflow</span>
              <small>edit and save</small>
            </div>
            <label className="workflow-field">
              <span>Workflow name</span>
              <input
                type="text"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Give the workflow a useful name"
              />
            </label>
            <label className="workflow-field">
              <span>Notes</span>
              <textarea
                value={draft.note}
                onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                placeholder="What should the person or agent know before starting?"
                rows={4}
              />
            </label>
            <label className="workflow-field">
              <span>Add step</span>
              <div className="workflow-inline-input">
                <input
                  type="text"
                  value={newStep}
                  onChange={(event) => setNewStep(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && addCustomStep()}
                  placeholder="Add a custom step"
                />
                <button type="button" onClick={addCustomStep}>
                  Add
                </button>
              </div>
            </label>
          </div>

          <div className="workflow-group">
            <div className="workflow-group-head">
              <span>Saved workflows</span>
              <small>{savedWorkflows.length} stored locally</small>
            </div>
            <div className="workflow-saved-list">
              {savedWorkflows.length ? (
                savedWorkflows.map((workflow) => (
                  <button
                    key={workflow.id}
                    type="button"
                    className={`workflow-saved-card ${workflow.id === draft.id ? 'is-active' : ''}`}
                    onClick={() => loadWorkflow(workflow)}
                  >
                    <strong>{workflow.name}</strong>
                    <small>{getWorkflowTemplate(workflow.templateId).title}</small>
                    <span>{getWorkflowSteps(workflow).length} steps · {workflow.skillIds.length} skills</span>
                  </button>
                ))
              ) : (
                <div className="workflow-empty">No saved workflows yet. Save one and it will stay available locally.</div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ListWidget() {
  return (
    <div className="list-surface">
      {['inbox', 'next action', 'blocked', 'archive'].map((item) => (
        <div className="list-item" key={item}>
          <span>{item}</span>
          <span>open</span>
        </div>
      ))}
    </div>
  );
}

function ScheduleWidget() {
  const slots = [
    { time: '07:30', label: 'Morning shift', note: 'brief / hydrate / review' },
    { time: '12:15', label: 'Project block', note: 'deep work / build' },
    { time: '16:30', label: 'Check-in', note: 'status / approvals' },
    { time: '21:00', label: 'Wrap-up', note: 'handoff / tidy / plan' },
  ];

  return (
    <div className="schedule-surface">
      <div className="schedule-head">
        <span>Today</span>
        <strong>4 blocks</strong>
      </div>
      {slots.map((slot, index) => (
        <div className="schedule-slot" key={slot.time}>
          <div className="schedule-time">{slot.time}</div>
          <div className="schedule-content">
            <span>{slot.label}</span>
            <small>{slot.note}</small>
          </div>
          <div className="schedule-bar">
            <i style={{ width: `${38 + index * 14}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

type LauncherWidgetProps = {
  onLaunchWorkspaceWidget: (kind: WorkspaceWidget['kind']) => void;
  workspaceWidgets: WorkspaceWidget[];
};

function LauncherWidget({ onLaunchWorkspaceWidget, workspaceWidgets }: LauncherWidgetProps) {
  const [desktopCommand, setDesktopCommand] = useState('');
  const [desktopApps, setDesktopApps] = useState([
    { name: 'Mission Control Center', note: 'primary desktop hub' },
    { name: 'DailyForge', note: 'separate planning surface' },
    { name: 'Browser', note: 'external web window' },
    { name: 'Files', note: 'native file manager' },
    { name: 'Terminal', note: 'command-line session' },
  ]);

  const apps = [
    { label: 'Command core', kind: 'overview' as const, note: 'open in workspace' },
    { label: 'Telemetry', kind: 'graph' as const, note: 'open in workspace' },
    { label: 'Audio preview', kind: 'audio' as const, note: 'open in workspace' },
    { label: 'Map / routes', kind: 'map' as const, note: 'open in workspace' },
    { label: 'Diagram preview', kind: 'diagram' as const, note: 'open in workspace' },
    { label: 'Project list', kind: 'project' as const, note: 'open in workspace' },
    { label: 'Markets', kind: 'news' as const, note: 'open graph library' },
    { label: 'Schedule', kind: 'schedule' as const, note: 'open in workspace' },
    { label: 'Browser', kind: 'browser' as const, note: 'open in workspace' },
    { label: 'Live TV', kind: 'watch-video' as const, note: 'open in workspace' },
    { label: 'File explorer', kind: 'file-explorer' as const, note: 'open in workspace' },
    { label: 'Window manager', kind: 'window-manager' as const, note: 'track open widgets' },
    { label: 'Spreadsheet', kind: 'sheet' as const, note: 'open in workspace' },
    { label: 'Docs', kind: 'docs' as const, note: 'open in workspace' },
    { label: 'Presentation', kind: 'slides' as const, note: 'open in workspace' },
    { label: 'Trading graph', kind: 'trading-graph' as const, note: 'focus market chart' },
    { label: 'Image preview', kind: 'image' as const, note: 'open in workspace' },
    { label: 'PDF', kind: 'pdf' as const, note: 'open in workspace' },
    { label: 'Media frame', kind: 'video' as const, note: 'open in workspace' },
    { label: 'Preview', kind: '3d' as const, note: 'open in workspace' },
    { label: '3D studio', kind: '3d-studio' as const, note: 'open in workspace' },
    { label: 'Workflows', kind: 'flow' as const, note: 'open in workspace' },
    { label: 'List', kind: 'list' as const, note: 'open in workspace' },
  ];
  const hasDesktopCommand = desktopCommand.trim().length > 0;

  const openInstalledApp = () => {
    const nextName = desktopCommand.trim();
    if (!nextName) return;
    setDesktopApps((current) => {
      const next = [{ name: nextName, note: 'loaded into desktop memory' }, ...current.filter((app) => app.name !== nextName)];
      return next.slice(0, 8);
    });
    setDesktopCommand('');
  };

  const getAppState = (kind: WorkspaceWidget['kind']) => {
    const widget = workspaceWidgets.find((item) => item.kind === kind);
    if (!widget) return 'closed';
    return widget.open ? 'open' : 'closed';
  };

  return (
    <div className="launcher-surface">
      <div className="launcher-desktop-bridge">
        <div className="launcher-desktop-head">
          <span>desktop hooks</span>
          <strong>load installed apps into memory</strong>
          <p>Command line stays. The bridge now lives beside the workspace launcher rather than impersonating a separate universe.</p>
        </div>
        <div className="launcher-desktop-controls">
          <label className="launcher-desktop-input">
            <span>Installed app or command</span>
            <input
              type="text"
              value={desktopCommand}
              onChange={(event) => setDesktopCommand(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && openInstalledApp()}
              placeholder="e.g. explorer.exe, obsidian, notepad.exe"
            />
          </label>
          <button type="button" className="launcher-desktop-button" onClick={openInstalledApp} disabled={!hasDesktopCommand}>
            Open installed app
          </button>
        </div>
        <div className="launcher-desktop-list" role="group" aria-label="Loaded desktop apps">
          {desktopApps.map((app) => (
            <button key={app.name} type="button" className="launcher-desktop-item">
              <span>{app.name}</span>
              <small>{app.note}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="launcher-summary">
        <span>workspace hooks</span>
        <strong>open / focus / stay in the workspace</strong>
      </div>
      <div className="launcher-grid">
        {apps.map((app) => {
          const state = getAppState(app.kind);

          return (
            <button
              key={app.kind}
              type="button"
              className="launcher-app"
              data-state={state}
              aria-label={`${app.label}, ${state === 'open' ? 'open and ready to focus' : 'closed'}`}
              onClick={() => onLaunchWorkspaceWidget(app.kind)}
            >
              <span>{app.label}</span>
              <small>{state === 'open' ? 'open · click to focus' : app.note}</small>
            </button>
          );
        })}
      </div>
      <p className="launcher-note">The launcher now opens widgets where they belong: in the workspace, not as a separate browser tantrum.</p>
    </div>
  );
}

function BrowserWidget() {
  const [url, setUrl] = useState('https://example.org');
  const [frameUrl, setFrameUrl] = useState(url);

  const submitUrl = () => {
    let next = url.trim();
    if (!next) return;
    if (!/^https?:\/\//i.test(next) && !next.startsWith('data:')) {
      next = `https://${next}`;
    }
    setFrameUrl(next);
    setUrl(next);
  };

  return (
    <div className="browser-surface">
      <div className="browser-bar">
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && submitUrl()}
          aria-label="Browser URL"
          placeholder="Enter a website or data URL"
        />
        <button type="button" onClick={submitUrl}>Go</button>
      </div>
      <div className="browser-bookmarks">
        {['https://example.org', 'https://developer.mozilla.org', 'https://news.ycombinator.com'].map((bookmark) => (
          <button key={bookmark} type="button" onClick={() => { setUrl(bookmark); setFrameUrl(bookmark); }}>
            {bookmark.replace('https://', '')}
          </button>
        ))}
      </div>
      <iframe title="Browser preview" src={frameUrl} className="browser-frame" />
    </div>
  );
}

type LiveTvSource = {
  name: string;
  badge: string;
  description: string;
  url: string;
  streamType: 'hls' | 'mp4';
};

const liveTvSources: LiveTvSource[] = [
  {
    name: 'Home tuner',
    badge: 'LAN',
    description: 'your local internet TV feed',
    url: 'http://192.168.1.50/live.m3u8',
    streamType: 'hls',
  },
  {
    name: 'Mux demo',
    badge: 'DEMO',
    description: 'public HLS test stream',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    streamType: 'hls',
  },
  {
    name: 'Fallback clip',
    badge: 'MP4',
    description: 'basic playback fallback',
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    streamType: 'mp4',
  },
];

const defaultLiveTvSource = liveTvSources[0] as LiveTvSource;

function LiveTvWidget() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const [draftUrl, setDraftUrl] = useState(defaultLiveTvSource.url);
  const [activeSource, setActiveSource] = useState<LiveTvSource>(defaultLiveTvSource);
  const [status, setStatus] = useState('Ready');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;

    const cleanupPlayer = () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.pause();
      video.removeAttribute('src');
      video.load();
    };

    const source = activeSource;
    const sourceUrl = source.url.trim();
    if (!sourceUrl) {
      setStatus('No stream URL loaded');
      return;
    }

    setIsLoading(true);
    setStatus(`Tuning ${source.name}`);
    cleanupPlayer();

    const finishReady = () => {
      if (cancelled) return;
      setIsLoading(false);
      setStatus(`Live on ${source.name}`);
      void video.play().catch(() => undefined);
    };

    const attachDirectSource = () => {
      video.src = sourceUrl;
      video.load();
      finishReady();
    };

    const looksLikeHls = source.streamType === 'hls' || /\.m3u8($|\?)/i.test(sourceUrl);
    if (!looksLikeHls) {
      attachDirectSource();
      return () => {
        cancelled = true;
        cleanupPlayer();
      };
    }

    const canPlayHlsNatively = Boolean(video.canPlayType('application/vnd.apple.mpegurl'));
    if (canPlayHlsNatively) {
      attachDirectSource();
      return () => {
        cancelled = true;
        cleanupPlayer();
      };
    }

    void import('hls.js')
      .then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          setIsLoading(false);
          setStatus('This browser cannot play HLS streams');
          return;
        }

        const player = new Hls({ lowLatencyMode: true, enableWorker: true });
        hlsRef.current = player;
        player.attachMedia(video);
        player.loadSource(sourceUrl);
        player.on(Hls.Events.MANIFEST_PARSED, () => finishReady());
        player.on(Hls.Events.ERROR, (_, data) => {
          if (cancelled) return;
          setIsLoading(false);
          setStatus(`Stream issue on ${source.name}: ${data?.details ?? 'unknown error'}`);
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setIsLoading(false);
        setStatus(`Failed to load HLS engine: ${error instanceof Error ? error.message : 'unknown error'}`);
      });

    return () => {
      cancelled = true;
      cleanupPlayer();
    };
  }, [activeSource]);

  const tuneCustomFeed = () => {
    const nextUrl = draftUrl.trim();
    if (!nextUrl) return;

    const isHlsFeed = /\.m3u8($|\?)/i.test(nextUrl);

    setActiveSource({
      name: 'Custom feed',
      badge: isHlsFeed ? 'HLS' : 'URL',
      description: 'your chosen internet TV source',
      url: nextUrl,
      streamType: isHlsFeed ? 'hls' : 'mp4',
    });
  };

  return (
    <div className="live-tv-surface">
      <div className="live-tv-header">
        <div className="live-tv-now-playing">
          <span>Live TV</span>
          <strong>{activeSource.name}</strong>
          <p>{activeSource.description}</p>
        </div>
        <div className="live-tv-status">
          <span>{isLoading ? 'Tuning' : 'On air'}</span>
          <strong>{status}</strong>
        </div>
      </div>

      <div className="live-tv-preset-list" role="group" aria-label="Live TV sources">
        {liveTvSources.map((source) => (
          <button
            key={source.name}
            type="button"
            className={`live-tv-preset ${source.name === activeSource.name ? 'is-active' : ''}`}
            aria-pressed={source.name === activeSource.name}
            onClick={() => {
              setDraftUrl(source.url);
              setActiveSource(source);
            }}
          >
            <span>{source.badge}</span>
            <strong>{source.name}</strong>
            <small>{source.description}</small>
          </button>
        ))}
      </div>

      <label className="live-tv-input">
        <span>Channel or stream URL</span>
        <input
          type="text"
          value={draftUrl}
          onChange={(event) => setDraftUrl(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && tuneCustomFeed()}
          placeholder="Paste an official HLS / MP4 source"
        />
      </label>

      <div className="live-tv-actions">
        <button type="button" onClick={tuneCustomFeed}>
          Tune feed
        </button>
        <small>Best with official HLS (.m3u8) feeds from your provider or home tuner.</small>
      </div>

      <video ref={videoRef} className="live-tv-frame" controls autoPlay playsInline preload="metadata" />
    </div>
  );
}

function LocalFileMiniPreview({ file }: { file: LocalFileRecord }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textSnippet, setTextSnippet] = useState('');

  useEffect(() => {
    let cancelled = false;
    setObjectUrl(null);
    setTextSnippet('');

    if (file.previewKind === 'image') {
      const nextUrl = URL.createObjectURL(file.file);
      setObjectUrl(nextUrl);
      return () => {
        cancelled = true;
        URL.revokeObjectURL(nextUrl);
      };
    }

    if (file.previewKind === 'text') {
      void file.file.text().then((content) => {
        if (cancelled) return;
        setTextSnippet(content.slice(0, 96).replace(/\s+/g, ' ').trim());
      });
    }

    return () => {
      cancelled = true;
    };
  }, [file]);

  if (file.previewKind === 'image' && objectUrl) {
    return <img className="file-explorer-item-preview-image" src={objectUrl} alt="" aria-hidden="true" />;
  }

  if (file.previewKind === 'text') {
    return <span className="file-explorer-item-preview-text">{textSnippet || 'Text file'}</span>;
  }

  return <span className={`file-explorer-item-preview-badge kind-${file.previewKind}`}>{file.previewKind}</span>;
}

function FileExplorerWidget({
  files,
  activeFileId,
  selectedFileId,
  folderEntries,
  folderPath,
  canBrowseFolder,
  onBrowseFiles,
  onBrowseFolder,
  onOpenPreview,
  onSelectFile,
  onClearFiles,
}: {
  files: LocalFileRecord[];
  activeFileId: string | null;
  selectedFileId: string | null;
  folderEntries: LocalFolderEntry[];
  folderPath: string | null;
  canBrowseFolder: boolean;
  onBrowseFiles: (files: FileList | File[]) => Promise<LocalFileRecord[]>;
  onBrowseFolder: () => void;
  onOpenPreview: (file: LocalFileRecord) => void;
  onSelectFile: (id: string | null) => void;
  onClearFiles: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeFile = files.find((record) => record.id === activeFileId) ?? null;
  const hasRealFolderEntries = folderEntries.length > 0;
  const folderTreeEntries = hasRealFolderEntries
    ? folderEntries
    : files.length
      ? files.map((record) => ({
          id: record.id,
          name: record.file.name,
          path: record.path,
          kind: 'file' as const,
          depth: 0,
          file: record.file,
        }))
      : [
          {
            id: 'general-use-folder',
            name: generalUseFolderLabel,
            path: generalUseFolderLabel,
            kind: 'directory' as const,
            depth: 0,
          },
        ];
  const visibleFolderPath = folderPath ?? generalUseFolderLabel;
  const loadedEntryCount = hasRealFolderEntries ? folderEntries.length : files.length;
  const selectedCountLabel = `${files.length} ${files.length === 1 ? 'item' : 'items'} loaded`;
  const explorerStatusLabel = activeFile
    ? `Previewing ${activeFile.path}`
    : folderEntries.length
      ? `Folder: ${visibleFolderPath}`
      : 'General use folder ready';

  const handleBrowseFilesClick = () => {
    fileInputRef.current?.click();
  };

  const handleBrowseFolderClick = () => {
    void onBrowseFolder();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    void onBrowseFiles(selectedFiles);
    event.target.value = '';
  };

  return (
    <div className="file-explorer-surface">
      <div className="file-explorer-head">
        <span>Local file browser</span>
        <strong>Choose files or folders from this PC.</strong>
        <div className="file-explorer-head-meta" role="status" aria-live="polite" aria-atomic="true">
          <span>{selectedCountLabel}</span>
          <small>{explorerStatusLabel}</small>
        </div>
      </div>

      <div className="file-explorer-toolbar">
        <button type="button" className="file-explorer-button" onClick={handleBrowseFilesClick}>
          Browse items
        </button>
        <button
          type="button"
          className="file-explorer-button is-muted"
          onClick={handleBrowseFolderClick}
          disabled={!canBrowseFolder}
          title={canBrowseFolder ? 'Open a general-use folder picker' : 'Folder picker is not available in this browser'}
        >
          Open folder
        </button>
        <button type="button" className="file-explorer-button is-muted" onClick={onClearFiles} disabled={!files.length && !folderEntries.length}>
          Clear loaded files
        </button>
        <input
          ref={fileInputRef}
          className="file-explorer-input"
          type="file"
          multiple
          aria-hidden="true"
          tabIndex={-1}
          onChange={handleFileChange}
        />
      </div>

      <div className="file-explorer-body">
        {folderTreeEntries.length ? (
          <section className="file-explorer-folder-tree" aria-label="Folder contents">
            <div className="file-explorer-folder-head">
              <span>{hasRealFolderEntries ? 'Folder tree' : 'General use folder'}</span>
              <small>{folderTreeEntries.length} items · depth {Math.max(...folderTreeEntries.map((entry) => entry.depth), 0)}</small>
            </div>
            <ul className="file-explorer-list file-explorer-list-tree">
              {folderTreeEntries.map((entry) => (
                <li key={entry.id} className={`file-explorer-item file-explorer-item-${entry.kind}`} style={{ paddingLeft: `${entry.depth * 12}px` }}>
                  <button
                    type="button"
                    className="file-explorer-item-button"
                    onClick={() => {
                      if (!entry.file) return;
                      void onBrowseFiles([entry.file]);
                      onSelectFile(createLocalFileRecord(entry.file).id);
                    }}
                    onDoubleClick={() => {
                      if (!entry.file) return;
                      void onBrowseFiles([entry.file]);
                      onSelectFile(createLocalFileRecord(entry.file).id);
                      void onOpenPreview(createLocalFileRecord(entry.file));
                    }}
                    aria-disabled={!entry.file}
                  >
                    <span className="file-explorer-item-preview">
                      <span className={`file-explorer-item-preview-badge kind-${entry.kind}`}>{entry.kind}</span>
                    </span>
                    <span className="file-explorer-item-copy">
                      <span className="file-explorer-item-name">{entry.path}</span>
                      <span className="file-explorer-item-meta">
                        <small>{entry.kind}</small>
                        {entry.file ? <small>{formatLocalFileSize(entry.file.size)}</small> : null}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {hasRealFolderEntries && files.length ? (
          <ul className="file-explorer-list" aria-label="Selected local files">
            {files.map((record) => {
              const isSelected = record.id === selectedFileId;
              const isActive = record.id === activeFileId;

              return (
                <li key={record.id} className={`file-explorer-item ${isActive ? 'is-active' : ''} ${isSelected ? 'is-selected' : ''}`}>
                  <button
                    type="button"
                    className="file-explorer-item-button"
                    onClick={() => onSelectFile(record.id)}
                    onDoubleClick={() => void onOpenPreview(record)}
                    aria-pressed={isSelected}
                    title="Single click to select, double click to open"
                  >
                    <span className="file-explorer-item-preview">
                      <LocalFileMiniPreview file={record} />
                    </span>
                    <span className="file-explorer-item-copy">
                      <span className="file-explorer-item-name">{record.path}</span>
                      <span className="file-explorer-item-meta">
                        <small>{record.previewKind}</small>
                        <small>{formatLocalFileSize(record.file.size)}</small>
                        <small>{record.file.type || 'unknown type'}</small>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="file-explorer-empty">
            <strong>General use folder ready.</strong>
            <p>Select files or open a folder from your PC, then single-click an item to select it and double-click to open it in the preview panel. The browser cannot rummage through the drive uninvited, which is arguably for the best.</p>
          </div>
        )}
      </div>

      <div className="file-explorer-footer">
        <span>{loadedEntryCount ? `${loadedEntryCount} ${loadedEntryCount === 1 ? 'entry' : 'entries'}` : 'No entries loaded'}</span>
        <small>Single-click selects · double-click opens.</small>
      </div>
    </div>
  );
}


function NativeAppWidget() {
  const apps = [
    { name: 'Mission Control Center', note: 'primary desktop hub' },
    { name: 'DailyForge', note: 'separate planning surface' },
    { name: 'Browser', note: 'external web window' },
    { name: 'Files', note: 'native file manager' },
    { name: 'Terminal', note: 'command-line session' },
  ];

  return (
    <div className="launcher-desktop-bridge native-app-surface">
      <div className="launcher-desktop-head">
        <span>desktop bridge</span>
        <strong>open installed app / external window</strong>
        <p>Bridge installed apps and external windows without pretending the browser can do an operating system’s job on its own.</p>
      </div>
      <div className="launcher-desktop-controls">
        <label className="launcher-desktop-input">
          <span>App or command</span>
          <input type="text" placeholder="e.g. obsidian, explorer.exe, notepad.exe" />
        </label>
        <button type="button" className="launcher-desktop-button">
          Open app
        </button>
      </div>
      <div className="launcher-desktop-list" aria-label="Loaded desktop apps">
        {apps.map((app) => (
          <button key={app.name} type="button" className="launcher-desktop-item">
            <span>{app.name}</span>
            <small>{app.note}</small>
          </button>
        ))}
      </div>
    </div>
  );
}


function WindowManagerWidget({
  widgets,
  onFocusWidget,
  onCloseWidget,
}: {
  widgets: WorkspaceWidget[];
  onFocusWidget: (id: string) => void;
  onCloseWidget: (id: string) => void;
}) {
  const openWidgets = [...widgets]
    .filter((widget) => widget.open)
    .sort((left, right) => right.zIndex - left.zIndex);

  return (
    <div className="window-manager-surface">
      <div className="window-manager-head">
        <div className="window-manager-head-copy">
          <span>live registry</span>
          <strong>{openWidgets.length} open · {widgets.length} total</strong>
        </div>
      </div>
      <div className="window-manager-list" role="list" aria-label="Open widgets">
        {openWidgets.length > 0 ? (
          openWidgets.map((widget) => (
            <div key={widget.id} className="window-manager-item" role="listitem">
              <button type="button" className="window-manager-item-button" onClick={() => onFocusWidget(widget.id)}>
                <span>{widget.title}</span>
                <small>{widget.kind} · z{widget.zIndex}</small>
              </button>
              <button
                type="button"
                className="window-manager-close"
                onClick={() => onCloseWidget(widget.id)}
                disabled={Boolean(widget.pinned)}
                aria-label={widget.pinned ? `${widget.title} is pinned` : `Close ${widget.title}`}
                title={widget.pinned ? `${widget.title} is pinned` : `Close ${widget.title}`}
              >
                ×
              </button>
            </div>
          ))
        ) : (
          <p className="window-manager-empty">No windows are open. Remarkably, the machine is being tidy on its own.</p>
        )}
      </div>
      <p className="window-manager-note">Open surfaces stay listed here. Pinned windows cannot be closed.</p>
    </div>
  );
}

type WorkspaceWidgetCardProps = {
  widget: WorkspaceWidget;
  onStartDrag: (event: ReactPointerEvent<HTMLElement>, id: string) => void;
  onStartResize: (event: ReactPointerEvent<HTMLElement>, id: string, edge: ResizeEdge) => void;
  onToggleOpen: (id: string) => void;
  onClose: (id: string) => void;
  showChrome?: boolean;
  localFiles: LocalFileRecord[];
  activeLocalFile: LocalFileRecord | null;
  activeLocalFileId: string | null;
  selectedLocalFileId: string | null;
  folderEntries: LocalFolderEntry[];
  folderPath: string | null;
  canBrowseFolder: boolean;
  activeMarketGraph: MarketGraph;
  onBrowseFiles: (files: FileList | File[]) => Promise<LocalFileRecord[]>;
  onBrowseFolder: () => void;
  onOpenPreview: (file: LocalFileRecord) => void;
  onSelectFile: (id: string | null) => void;
  onClearFiles: () => void;
  onLaunchWorkspaceWidget: (kind: WorkspaceWidget['kind']) => void;
  onSelectMarketGraph: (graph: MarketGraph) => void;
  workspaceWidgets: WorkspaceWidget[];
  onFocusWidget: (id: string) => void;
  onCloseWidget: (id: string) => void;
};

function WorkspaceWidgetCard(props: WorkspaceWidgetCardProps) {
  const {
    widget,
    onStartDrag,
    onStartResize,
    onToggleOpen,
    onClose,
    showChrome = true,
    localFiles,
    activeLocalFile,
    activeLocalFileId,
    selectedLocalFileId,
    folderEntries,
    folderPath,
    canBrowseFolder,
    activeMarketGraph,
    onBrowseFiles,
    onBrowseFolder,
    onOpenPreview,
    onSelectFile,
    onClearFiles,
    onLaunchWorkspaceWidget,
    onSelectMarketGraph,
    workspaceWidgets,
    onFocusWidget,
    onCloseWidget,
  } = props;
  const previewFile = widget.previewFileId ? localFiles.find((record) => record.id === widget.previewFileId) ?? null : null;

  return (
    <article
      className={`workspace-widget ${widget.open ? 'is-open' : 'is-closed'} kind-${widget.kind}`}
      style={
        {
          left: `${widget.x}px`,
          top: `${widget.y}px`,
          width: `${widget.width}px`,
          height: `${widget.open ? widget.height : 58}px`,
          zIndex: widget.zIndex,
          '--widget-surface-alpha': widget.surfaceAlpha,
          '--widget-line-alpha': widget.lineAlpha,
        } as CSSProperties
      }
      onPointerDown={showChrome ? (event) => onStartDrag(event, widget.id) : undefined}
    >
      {showChrome ? (
        <>
          <div className="widget-labels" aria-hidden="true">
            <span className="widget-title">{widget.title}</span>
            <span className="widget-subtitle">{widget.subtitle}</span>
          </div>

          <div className="widget-chrome-actions" aria-label={`${widget.title} window controls`}>
            <button
              type="button"
              className="widget-toggle"
              onClick={(event) => {
                event.stopPropagation();
                onToggleOpen(widget.id);
              }}
              aria-label={widget.open ? `Minimize ${widget.title}` : `Maximize ${widget.title}`}
              title={widget.open ? `Minimize ${widget.title}` : `Maximize ${widget.title}`}
            >
              {widget.open ? '▴' : '▾'}
            </button>
            <button
              type="button"
              className="widget-close"
              disabled={Boolean(widget.pinned)}
              onClick={(event) => {
                event.stopPropagation();
                onClose(widget.id);
              }}
              aria-label={widget.pinned ? `${widget.title} is pinned` : `Close ${widget.title}`}
              title={widget.pinned ? `${widget.title} is pinned` : `Close ${widget.title}`}
            >
              ×
            </button>
          </div>
        </>
      ) : null}

      <div
        className={`widget-body ${widget.kind === 'file-explorer' ? 'widget-body-file-explorer' : ''} ${widget.kind === 'window-manager' ? 'widget-body-window-manager' : ''}`}
      >
        {widget.kind === 'overview' && <OverviewWidget />}
        {widget.kind === 'graph' && <GraphWidget />}
        {widget.kind === 'trading-graph' && <TradingGraphWidget graph={activeMarketGraph} />}
        {widget.kind === 'sheet' && <SpreadsheetWidget />}
        {widget.kind === 'docs' && <DocsWidget />}
        {widget.kind === 'slides' && <SlidesWidget />}
        {widget.kind === 'image' && <ImageWidget />}
        {widget.kind === 'pdf' && <PdfWidget />}
        {widget.kind === 'audio' && <AudioWidget />}
        {widget.kind === 'map' && <MapWidget />}
        {widget.kind === 'diagram' && <DiagramWidget />}
        {widget.kind === 'project' && <ProjectWidget />}
        {widget.kind === 'news' && <NewsWidget activeGraph={activeMarketGraph} onSelectGraph={onSelectMarketGraph} />}
        {widget.kind === 'schedule' && <ScheduleWidget />}
        {widget.kind === 'launcher' && <LauncherWidget onLaunchWorkspaceWidget={onLaunchWorkspaceWidget} workspaceWidgets={workspaceWidgets} />}
        {widget.kind === 'browser' && <BrowserWidget />}
        {widget.kind === 'watch-video' && <LiveTvWidget />}
        {widget.kind === 'file-explorer' && (
          <FileExplorerWidget
            files={localFiles}
            activeFileId={activeLocalFileId}
            selectedFileId={selectedLocalFileId}
            folderEntries={folderEntries}
            folderPath={folderPath}
            canBrowseFolder={canBrowseFolder}
            onBrowseFiles={onBrowseFiles}
            onBrowseFolder={onBrowseFolder}
            onOpenPreview={onOpenPreview}
            onSelectFile={onSelectFile}
            onClearFiles={onClearFiles}
          />
        )}
        {widget.kind === 'native-app' && <LauncherWidget onLaunchWorkspaceWidget={onLaunchWorkspaceWidget} workspaceWidgets={workspaceWidgets} />}
        {widget.kind === 'window-manager' && <WindowManagerWidget widgets={workspaceWidgets} onFocusWidget={onFocusWidget} onCloseWidget={onCloseWidget} />}
        {widget.kind === 'video' && <VideoWidget />}
        {widget.kind === '3d' && <PreviewWidget file={previewFile} onBrowseFiles={onBrowseFiles} onOpenPreview={onOpenPreview} />}
        {widget.kind === '3d-studio' && <ModelStudioWidget />}
        {widget.kind === 'flow' && <WorkflowWidget />}
        {widget.kind === 'list' && <ListWidget />}
      </div>

      <WidgetResizeHandles widget={widget} onStartResize={onStartResize} showChrome={showChrome} />
    </article>
  );
}

type WorkspaceProps = {
  panelKind?: WorkspaceWidget['kind'] | null;
};

export function Workspace({ panelKind = null }: WorkspaceProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const storedWidgets = useMemo(() => loadStoredWidgetState(), []);
  const widgetsRef = useRef(storedWidgets ?? initialWidgetState);
  const interactionRef = useRef<InteractionState | null>(null);
  const compactLayoutAppliedRef = useRef(Boolean(storedWidgets));
  const [widgets, setWidgets] = useState(storedWidgets ?? initialWidgetState);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [nextLaunchIndex, setNextLaunchIndex] = useState(0);
  const [localFiles, setLocalFiles] = useState<LocalFileRecord[]>([]);
  const [selectedLocalFileId, setSelectedLocalFileId] = useState<string | null>(null);
  const [activeLocalFileId, setActiveLocalFileId] = useState<string | null>(null);
  const [folderEntries, setFolderEntries] = useState<LocalFolderEntry[]>([]);
  const [folderPath, setFolderPath] = useState<string | null>(generalUseFolderLabel);
  const persistedLocalFilesLoadedRef = useRef(false);
  const [activeMarketGraphId, setActiveMarketGraphId] = useState(defaultMarketGraph.id);
  const canBrowseFolder = typeof window !== 'undefined' && typeof (window as Window & { showDirectoryPicker?: ShowDirectoryPickerFn }).showDirectoryPicker === 'function';

  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  useEffect(() => {
    let cancelled = false;

    void readPersistedLocalFiles().then((records) => {
      if (cancelled) return;
      setLocalFiles(records);
      setSelectedLocalFileId(null);
      setActiveLocalFileId(null);
      persistedLocalFilesLoadedRef.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!persistedLocalFilesLoadedRef.current) return;
    void writePersistedLocalFiles(localFiles);
  }, [localFiles]);

  useEffect(() => {
    if (activeLocalFileId) return;

    const previewWidget = widgetsRef.current.find((widget) => widget.kind === '3d' && widget.previewFileId);
    if (!previewWidget?.previewFileId) return;

    const restoredFile = localFiles.find((record) => record.id === previewWidget.previewFileId) ?? null;
    if (!restoredFile) return;

    setSelectedLocalFileId(restoredFile.id);
    setActiveLocalFileId(restoredFile.id);
  }, [activeLocalFileId, localFiles]);

  useEffect(() => {
    const updateBounds = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      setBounds({ width: rect.width, height: rect.height });
    };

    updateBounds();

    const observer = new ResizeObserver(updateBounds);
    if (canvasRef.current) observer.observe(canvasRef.current);

    window.addEventListener('resize', updateBounds);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateBounds);
    };
  }, []);

  useEffect(() => {
    if (!bounds.width || !bounds.height) return;

    const isCompact = bounds.width < 860;
    if (!isCompact) {
      compactLayoutAppliedRef.current = false;
      return;
    }

    if (compactLayoutAppliedRef.current || interactionRef.current) return;

    compactLayoutAppliedRef.current = true;
    setWidgets(createCompactLayout(bounds.width, bounds.height));
  }, [bounds.height, bounds.width]);

  useEffect(() => {
    const stopInteraction = () => {
      interactionRef.current = null;
    };

    window.addEventListener('pointerup', stopInteraction);
    window.addEventListener('pointercancel', stopInteraction);
    window.addEventListener('blur', stopInteraction);

    return () => {
      window.removeEventListener('pointerup', stopInteraction);
      window.removeEventListener('pointercancel', stopInteraction);
      window.removeEventListener('blur', stopInteraction);
    };
  }, []);

  const orderedWidgets = useMemo(() => [...widgets].sort((a, b) => a.zIndex - b.zIndex), [widgets]);
  const nextLaunchKind = launchableWindowKinds[nextLaunchIndex % launchableWindowKinds.length];

  const openPanelWindow = (kind: WorkspaceWidget['kind']) => {
    if (typeof window === 'undefined') return;

    const url = buildPanelWindowUrl(kind);
    const popup = window.open(url.toString(), '_blank', 'popup=yes,width=1280,height=900');
    if (!popup) {
      window.location.assign(url.toString());
      return;
    }

    popup.focus?.();
    setNextLaunchIndex((current) => current + 1);
  };

  const openNextPanelWindow = () => {
    openPanelWindow(nextLaunchKind);
  };

  const raiseWidget = (id: string) => {
    setWidgets((current) => {
      const highest = current.reduce((max, widget) => Math.max(max, widget.zIndex), 0);
      return current.map((widget) => (widget.id === id ? { ...widget, zIndex: highest + 1 } : widget));
    });
  };

  const startDrag = (event: ReactPointerEvent<HTMLElement>, id: string) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, input, textarea, select, a, video, [role="button"]')) return;

    const widget = widgetsRef.current.find((item) => item.id === id);
    const canvas = canvasRef.current;
    if (!widget || !canvas) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    raiseWidget(id);

    interactionRef.current = {
      id,
      mode: 'drag',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: widget.x,
      startTop: widget.y,
      startWidth: widget.width,
      startHeight: widget.height,
    };
  };

  const startResize = (event: ReactPointerEvent<HTMLElement>, id: string, edge: ResizeEdge) => {
    if (event.button !== 0) return;

    const widget = widgetsRef.current.find((item) => item.id === id);
    if (!widget) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    raiseWidget(id);

    interactionRef.current = {
      id,
      mode: 'resize',
      edge,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: widget.x,
      startTop: widget.y,
      startWidth: widget.width,
      startHeight: widget.height,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const currentWidget = widgetsRef.current.find((widget) => widget.id === interaction.id);
    if (!currentWidget) return;

    const deltaX = event.clientX - interaction.startX;
    const deltaY = event.clientY - interaction.startY;

    if (interaction.mode === 'drag') {
      const nextLeft = clamp(
        interaction.startLeft + deltaX,
        0,
        Math.max(0, canvasRect.width - currentWidget.width),
      );
      const nextTop = clamp(
        interaction.startTop + deltaY,
        0,
        Math.max(0, canvasRect.height - currentWidget.height),
      );

      setWidgets((current) =>
        current.map((widget) =>
          widget.id === interaction.id
            ? {
                ...widget,
                x: nextLeft,
                y: nextTop,
              }
            : widget,
        ),
      );
      return;
    }

    const isClosed = !currentWidget.open;
    const edge = interaction.edge ?? 'corner';
    let nextLeft = interaction.startLeft;
    let nextWidth = interaction.startWidth;
    let nextHeight = interaction.startHeight;

    if (edge === 'left') {
      nextLeft = interaction.startLeft + deltaX;
      nextWidth = interaction.startWidth - deltaX;
    } else if (edge === 'right') {
      nextWidth = interaction.startWidth + deltaX;
    } else if (edge === 'bottom') {
      nextHeight = interaction.startHeight + deltaY;
    } else {
      nextWidth = interaction.startWidth + deltaX;
      nextHeight = interaction.startHeight + deltaY;
    }

    if (isClosed) {
      nextHeight = interaction.startHeight;
      if (edge !== 'left') nextLeft = interaction.startLeft;
    }

    nextWidth = Math.max(currentWidget.minWidth, nextWidth);
    nextHeight = Math.max(currentWidget.minHeight, nextHeight);

    if (edge === 'left' && nextWidth === currentWidget.minWidth) {
      nextLeft = interaction.startLeft + (interaction.startWidth - currentWidget.minWidth);
    }

    setWidgets((current) =>
      current.map((widget) =>
        widget.id === interaction.id
          ? {
              ...widget,
              x: edge === 'left' ? nextLeft : widget.x,
              y: widget.y,
              width: nextWidth,
              height: nextHeight,
            }
          : widget,
      ),
    );
  };

  const stopInteraction = () => {
    interactionRef.current = null;
  };

  const toggleWidget = (id: string) => {
    raiseWidget(id);
    setWidgets((current) =>
      current.map((widget) =>
        widget.id === id ? { ...widget, open: !widget.open, zIndex: widget.zIndex + 1 } : widget,
      ),
    );
  };

  const closeWidget = (id: string) => {
    setWidgets((current) =>
      current.map((widget) =>
        widget.id === id
          ? {
              ...widget,
              open: false,
              zIndex: widget.zIndex + 1,
            }
          : widget,
      ),
    );
  };

  const focusWidget = (id: string, open = true) => {
    raiseWidget(id);
    if (!open) return;

    setWidgets((current) =>
      current.map((widget) =>
        widget.id === id
          ? {
              ...widget,
              open: true,
              zIndex: widget.zIndex + 1,
            }
          : widget,
      ),
    );
  };

  const openWorkspaceWidget = (kind: WorkspaceWidget['kind']) => {
    const target = widgetsRef.current.find((widget) => widget.kind === kind);
    if (target) {
      focusWidget(target.id);
      return;
    }

    setWidgets((current) => {
      const highest = current.reduce((max, widget) => Math.max(max, widget.zIndex), 0);
      const nextWidget = getFocusedWidget(kind, bounds.width || 1200, bounds.height || 800);
      const next = [...current, { ...nextWidget, zIndex: highest + 1 }];
      widgetsRef.current = next;
      return next;
    });
  };

  const openMarketGraph = (graph: MarketGraph) => {
    setActiveMarketGraphId(graph.id);
    openWorkspaceWidget('trading-graph');
  };

  const browseFolder = async () => {
    const picker = (window as Window & { showDirectoryPicker?: ShowDirectoryPickerFn }).showDirectoryPicker;
    if (!picker) return;

    try {
      const handle = await picker({ mode: 'read', startIn: 'documents' });
      setFolderPath(handle.name ?? generalUseFolderLabel);
      const entries = await readFolderEntries(handle);
      setFolderEntries(entries);
      const files = entries.flatMap((entry) => (entry.file ? [entry.file] : []));
      if (files.length) {
        await importLocalFiles(files);
      }
      focusWidget('file-explorer');
    } catch {
      // Native picker cancelled; nothing to do. A rare moment of restraint.
    }
  };

  const openPreviewWidget = (file: LocalFileRecord, dimensions: LocalImageDimensions | null = null) => {
    const blueprint = widgetBlueprints['3d'];
    const viewportWidth = Math.max(320, bounds.width || window.innerWidth || blueprint.minWidth);
    const viewportHeight = Math.max(240, bounds.height || window.innerHeight || blueprint.minHeight);
    const chromeWidth = 36;
    const chromeHeight = 108;
    const highest = widgetsRef.current.reduce((max, widget) => Math.max(max, widget.zIndex), 0);
    const existing = widgetsRef.current.find((widget) => widget.kind === '3d' && widget.previewFileId === file.id);

    if (existing) {
      setWidgets((current) => {
        const next = current.map((widget) =>
          widget.id === existing.id
            ? {
                ...widget,
                open: true,
                subtitle: file.path,
                zIndex: highest + 1,
              }
            : widget,
        );
        widgetsRef.current = next;
        return next;
      });
      return;
    }

    const scale = dimensions ? Math.min((viewportWidth * 0.88) / dimensions.width, (viewportHeight * 0.86) / dimensions.height, 1) : 1;
    const nextWidth = dimensions ? Math.max(blueprint.minWidth, Math.round(dimensions.width * scale) + chromeWidth) : blueprint.minWidth;
    const nextHeight = dimensions ? Math.max(blueprint.minHeight, Math.round(dimensions.height * scale) + chromeHeight) : blueprint.minHeight;
    const offset = Math.min(72, widgetsRef.current.filter((widget) => widget.kind === '3d').length * 18);

    setWidgets((current) => {
      const highestZ = current.reduce((max, widget) => Math.max(max, widget.zIndex), 0);
      const nextWidget: WorkspaceWidget = {
        id: `preview-${file.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: '3d',
        title: 'Preview',
        subtitle: file.path,
        x: clampNumber(528 + offset, 528, 0, Math.max(0, viewportWidth - nextWidth)),
        y: clampNumber(66 + offset, 66, 0, Math.max(0, viewportHeight - nextHeight)),
        width: nextWidth,
        height: nextHeight,
        zIndex: highestZ + 1,
        surfaceAlpha: blueprint.surfaceAlpha,
        lineAlpha: blueprint.lineAlpha,
        open: true,
        minWidth: blueprint.minWidth,
        minHeight: blueprint.minHeight,
        previewFileId: file.id,
      };
      const next = [...current, nextWidget];
      widgetsRef.current = next;
      return next;
    });
  };

  const importLocalFiles = async (selected: FileList | File[]) => {
    const imported = Array.from(selected, createLocalFileRecord);
    if (!imported.length) return [] as LocalFileRecord[];

    const enriched = await Promise.all(
      imported.map(async (record) => ({
        ...record,
        imageDimensions: record.previewKind === 'image' ? await measureImageDimensions(record.file) : null,
      })),
    );

    setLocalFiles((current) => {
      const byId = new Map(current.map((record) => [record.id, record]));
      enriched.forEach((record) => {
        byId.set(record.id, record);
      });
      return Array.from(byId.values()).sort((left, right) => left.path.localeCompare(right.path));
    });

    const first = enriched[0];
    setSelectedLocalFileId(first.id);
    return enriched;
  };

  const openLocalPreview = async (file: LocalFileRecord) => {
    setSelectedLocalFileId(file.id);
    setActiveLocalFileId(file.id);
    const dimensions = file.previewKind === 'image' ? file.imageDimensions ?? (await measureImageDimensions(file.file)) : null;
    openPreviewWidget(file, dimensions);
  };

  const clearLocalFiles = () => {
    setLocalFiles([]);
    setSelectedLocalFileId(null);
    setActiveLocalFileId(null);
    setFolderEntries([]);
    setFolderPath(generalUseFolderLabel);
    setWidgets((current) => {
      const next = current.map((widget) => (widget.kind === '3d' ? { ...widget, previewFileId: null } : widget));
      widgetsRef.current = next;
      return next;
    });
    void clearPersistedLocalFiles();
  };

  const activeLocalFile = useMemo(
    () => localFiles.find((record) => record.id === activeLocalFileId) ?? null,
    [activeLocalFileId, localFiles],
  );
  const activeMarketGraph = useMemo(() => getMarketGraph(activeMarketGraphId), [activeMarketGraphId]);

  if (panelKind) {
    const focusedWidget = getFocusedWidget(panelKind, bounds.width || 1200, bounds.height || 800);

    return (
      <section className="workspace-shell workspace-shell-panel">
        <div className="workspace-atmosphere workspace-atmosphere-a" aria-hidden="true" />
        <div className="workspace-atmosphere workspace-atmosphere-b" aria-hidden="true" />
        <div className="workspace-grid" aria-hidden="true" />

        <div className="workspace-head workspace-head-panel">
          <div className="workspace-brand">Mission Control Center</div>
          <StatusChip tone="ice">detached page · drag the OS window to another screen</StatusChip>
          <div className="workspace-launcher">
            <button
              type="button"
              className="workspace-launch-button"
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete('panel');
                window.location.assign(url.toString());
              }}
            >
              Open hub
            </button>
            <button type="button" className="workspace-launch-button is-muted" onClick={() => openPanelWindow(nextLaunchKind)}>
              Add next page
            </button>
          </div>
        </div>

        <div className="workspace-panel-stage">
          <WorkspaceWidgetCard
            widget={focusedWidget}
            onStartDrag={startDrag}
            onStartResize={startResize}
            onToggleOpen={toggleWidget}
            onClose={closeWidget}
            showChrome={panelKind === 'browser'}
            localFiles={localFiles}
            activeLocalFile={activeLocalFile}
            activeLocalFileId={activeLocalFileId}
            selectedLocalFileId={selectedLocalFileId}
            folderEntries={folderEntries}
            folderPath={folderPath}
            canBrowseFolder={canBrowseFolder}
            activeMarketGraph={activeMarketGraph}
            onBrowseFiles={importLocalFiles}
            onBrowseFolder={browseFolder}
            onOpenPreview={openLocalPreview}
            onSelectFile={setSelectedLocalFileId}
            onClearFiles={clearLocalFiles}
            onLaunchWorkspaceWidget={openWorkspaceWidget}
            onSelectMarketGraph={openMarketGraph}
            workspaceWidgets={widgets}
            onFocusWidget={focusWidget}
            onCloseWidget={closeWidget}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-shell">
      <div className="workspace-atmosphere workspace-atmosphere-a" aria-hidden="true" />
      <div className="workspace-atmosphere workspace-atmosphere-b" aria-hidden="true" />
      <div className="workspace-grid" aria-hidden="true" />

      <VisualLab />

      <div className="workspace-head">
        <div className="workspace-brand">Mission Control Center</div>
        <StatusChip tone="cool">tailnet live · drag · resize · stack</StatusChip>
        <div className="workspace-launcher">
          <button type="button" className="workspace-launch-button" onClick={openNextPanelWindow}>
            Add page · {getWidgetLabel(nextLaunchKind)}
          </button>
          <div className="workspace-launch-pills" aria-label="Window launch shortcuts">
            {launchableWindowKinds.map((kind) => (
              <button key={kind} type="button" className="workspace-launch-pill" onClick={() => openPanelWindow(kind)}>
                {getWidgetLabel(kind)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className="workspace-canvas"
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerUp={stopInteraction}
        onPointerCancel={stopInteraction}
      >
        {orderedWidgets.map((widget) => (
          <WorkspaceWidgetCard
            key={widget.id}
            widget={widget}
            onStartDrag={startDrag}
            onStartResize={startResize}
            onToggleOpen={toggleWidget}
            onClose={closeWidget}
            localFiles={localFiles}
            activeLocalFile={activeLocalFile}
            activeLocalFileId={activeLocalFileId}
            selectedLocalFileId={selectedLocalFileId}
            folderEntries={folderEntries}
            folderPath={folderPath}
            canBrowseFolder={canBrowseFolder}
            activeMarketGraph={activeMarketGraph}
            onBrowseFiles={importLocalFiles}
            onBrowseFolder={browseFolder}
            onOpenPreview={openLocalPreview}
            onSelectFile={setSelectedLocalFileId}
            onClearFiles={clearLocalFiles}
            onLaunchWorkspaceWidget={openWorkspaceWidget}
            onSelectMarketGraph={openMarketGraph}
            workspaceWidgets={widgets}
            onFocusWidget={focusWidget}
            onCloseWidget={closeWidget}
          />
        ))}
      </div>
    </section>
  );
}
