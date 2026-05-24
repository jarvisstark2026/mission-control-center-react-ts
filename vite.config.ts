import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
    fileParallelism: false,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    allowedHosts: ['jarvis.tailnet-device.ts.net', 'wsl-hermes-host.tailnet-device.ts.net', 'localhost', '127.0.0.1'],
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    allowedHosts: ['jarvis.tailnet-device.ts.net', 'wsl-hermes-host.tailnet-device.ts.net', 'localhost', '127.0.0.1'],
  },
});
