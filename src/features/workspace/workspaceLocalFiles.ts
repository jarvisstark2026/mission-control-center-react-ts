export type LocalPreviewKind = 'image' | 'audio' | 'video' | 'pdf' | 'text' | 'model' | 'unsupported';

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
  let db: IDBDatabase;
  try {
    db = await openLocalFilesDb();
  } catch {
    return [];
  }

  try {
    return await new Promise<LocalFileRecord[]>((resolve, reject) => {
      const tx = db.transaction(localFilesStoreName, 'readonly');
      const store = tx.objectStore(localFilesStoreName);
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result as LocalFileRecord[]) ?? []);
      request.onerror = () => reject(request.error ?? new Error('Unable to load local files'));
    });
  } catch {
    return [];
  } finally {
    db.close();
  }
}

export async function writePersistedLocalFiles(records: LocalFileRecord[]): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) return;
  let db: IDBDatabase;
  try {
    db = await openLocalFilesDb();
  } catch {
    return;
  }

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
  } catch {
    return;
  } finally {
    db.close();
  }
}

export async function clearPersistedLocalFiles(): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) return;
  let db: IDBDatabase;
  try {
    db = await openLocalFilesDb();
  } catch {
    return;
  }

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
  } catch {
    return;
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
  if (['glb', 'gltf'].includes(extension)) {
    return 'model';
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
  if (classifyLocalFile(file) !== 'image' || typeof URL === 'undefined' || typeof Image === 'undefined') return null;

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

export async function readLocalFileTextPreview(
  file: File,
  maxCharacters: number,
  { compactWhitespace = false }: { compactWhitespace?: boolean } = {},
): Promise<string> {
  const characterLimit = Math.max(0, maxCharacters);
  const byteLimit = Math.min(file.size, Math.max(characterLimit * 4, 1024));
  const content = await file.slice(0, byteLimit).text();
  const trimmedContent = content.slice(0, characterLimit);

  return compactWhitespace ? trimmedContent.replace(/\s+/g, ' ').trim() : trimmedContent;
}

const objectUrlPreviewKinds = new Set<LocalPreviewKind>(['image', 'audio', 'video', 'pdf', 'model', 'unsupported']);

export function createLocalFileObjectUrl(file: Pick<LocalFileRecord, 'file' | 'previewKind'>): string | null {
  if (!objectUrlPreviewKinds.has(file.previewKind) || typeof URL === 'undefined') return null;

  return URL.createObjectURL(file.file);
}

export function revokeLocalFileObjectUrl(objectUrl: string | null): void {
  if (!objectUrl || typeof URL === 'undefined') return;

  URL.revokeObjectURL(objectUrl);
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
