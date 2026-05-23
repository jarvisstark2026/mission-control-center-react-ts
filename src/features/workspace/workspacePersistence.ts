export type WorkspacePersistenceAdapter = {
  readText: (key: string) => string | null;
  writeText: (key: string, value: string) => boolean;
  remove: (key: string) => boolean;
  keys: () => string[];
};

function getLocalStorage() {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export const localWorkspacePersistenceAdapter: WorkspacePersistenceAdapter = {
  readText(key) {
    try {
      return getLocalStorage()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  writeText(key, value) {
    try {
      getLocalStorage()?.setItem(key, value);
      return Boolean(getLocalStorage());
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      getLocalStorage()?.removeItem(key);
      return Boolean(getLocalStorage());
    } catch {
      return false;
    }
  },
  keys() {
    try {
      const storage = getLocalStorage();
      return storage ? Object.keys(storage) : [];
    } catch {
      return [];
    }
  },
};

let activeWorkspacePersistenceAdapter = localWorkspacePersistenceAdapter;

export function getWorkspacePersistenceAdapter() {
  return activeWorkspacePersistenceAdapter;
}

export function setWorkspacePersistenceAdapter(adapter: WorkspacePersistenceAdapter | null) {
  activeWorkspacePersistenceAdapter = adapter ?? localWorkspacePersistenceAdapter;
}
