let fallbackIdCounter = 0;

export function createId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  fallbackIdCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}`;
}
