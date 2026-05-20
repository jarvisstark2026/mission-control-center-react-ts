export function readLocalStorageJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeLocalStorageJson(key: string, value: unknown): boolean {
  if (typeof window === 'undefined') return false;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeLocalStorageItem(key: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
