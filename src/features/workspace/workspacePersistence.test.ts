import { afterEach, describe, expect, it } from 'vitest';

import { readLocalStorageJson, writeLocalStorageJson } from './browserStorage';
import { getWorkspacePersistenceAdapter, setWorkspacePersistenceAdapter, type WorkspacePersistenceAdapter } from './workspacePersistence';

describe('workspace persistence adapter', () => {
  afterEach(() => {
    setWorkspacePersistenceAdapter(null);
    window.localStorage.clear();
  });

  it('lets workspace storage use a replaceable desktop-safe adapter', () => {
    const memory = new Map<string, string>();
    const adapter: WorkspacePersistenceAdapter = {
      readText: (key) => memory.get(key) ?? null,
      writeText: (key, value) => {
        memory.set(key, value);
        return true;
      },
      remove: (key) => memory.delete(key),
      keys: () => Array.from(memory.keys()),
    };

    setWorkspacePersistenceAdapter(adapter);

    expect(writeLocalStorageJson('workspace-test', { ok: true })).toBe(true);
    expect(readLocalStorageJson<{ ok: boolean }>('workspace-test')).toEqual({ ok: true });
    expect(window.localStorage.getItem('workspace-test')).toBeNull();
  });

  it('restores the default local storage adapter', () => {
    setWorkspacePersistenceAdapter(null);

    expect(getWorkspacePersistenceAdapter().writeText('workspace-test', 'ok')).toBe(true);
    expect(window.localStorage.getItem('workspace-test')).toBe('ok');
  });
});
