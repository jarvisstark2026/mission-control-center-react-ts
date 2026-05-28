import { describe, expect, it } from 'vitest';

import { hermesApiKeySecretRef, isDesktopAgentSecretStoreAvailable, writeAgentBridgeSecret } from './agentBridgeSecrets';

describe('agentBridgeSecrets', () => {
  it('reports browser preview secret storage as unavailable', async () => {
    expect(isDesktopAgentSecretStoreAvailable()).toBe(false);

    await expect(writeAgentBridgeSecret('secret')).resolves.toMatchObject({
      available: false,
      keyRef: hermesApiKeySecretRef,
      error: expect.stringContaining('Desktop credential storage'),
    });
  });
});
