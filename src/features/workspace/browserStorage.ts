import { getWorkspacePersistenceAdapter } from './workspacePersistence';

export function readStorageText(key: string): string | null {
  return getWorkspacePersistenceAdapter().readText(key);
}

export function writeStorageText(key: string, value: string): boolean {
  return getWorkspacePersistenceAdapter().writeText(key, value);
}

export function readLocalStorageJson<T>(key: string): T | null {
  try {
    const raw = readStorageText(key);
    if (!raw) return null;

    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeLocalStorageJson(key: string, value: unknown): boolean {
  try {
    return writeStorageText(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

export function removeLocalStorageItem(key: string): boolean {
  return getWorkspacePersistenceAdapter().remove(key);
}

export function listLocalStorageKeys(): string[] {
  return getWorkspacePersistenceAdapter().keys();
}
