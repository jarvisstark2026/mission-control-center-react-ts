export type LocalPreviewKind = 'image' | 'audio' | 'video' | 'pdf' | 'text' | 'unsupported';

export type LocalImageDimensions = {
  width: number;
  height: number;
};

export type LocalFileRecord = {
  id: string;
  file: File;
  path: string;
  previewKind: LocalPreviewKind;
  imageDimensions?: LocalImageDimensions | null;
};

export type LocalFolderEntry = {
  id: string;
  name: string;
  path: string;
  kind: 'file' | 'directory';
  depth: number;
  file?: File;
};

export type FileSystemFileHandleLike = {
  kind: 'file';
  name: string;
  getFile: () => Promise<File>;
};

export type FileSystemDirectoryHandleLike = {
  kind: 'directory';
  name: string;
  values: () => AsyncIterableIterator<FileSystemHandleLike>;
};

export type FileSystemHandleLike = FileSystemFileHandleLike | FileSystemDirectoryHandleLike;

export type ShowDirectoryPickerFn = (options?: { mode?: 'read'; startIn?: string }) => Promise<FileSystemDirectoryHandleLike>;

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

export async function readPersistedLocalFiles(): Promise<LocalFileRecord[]> {
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

export async function writePersistedLocalFiles(records: LocalFileRecord[]): Promise<void> {
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

export async function clearPersistedLocalFiles(): Promise<void> {
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

export function createLocalFileRecord(file: File): LocalFileRecord {
  const path = getLocalFilePath(file);
  const fingerprint = `${path}:${file.size}:${file.lastModified}`;

  return {
    id: fingerprint,
    file,
    path,
    previewKind: classifyLocalFile(file),
  };
}

export async function measureImageDimensions(file: File): Promise<LocalImageDimensions | null> {
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

export const generalUseFolderLabel = 'General use';

export async function readFolderEntries(
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

export function formatLocalFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
