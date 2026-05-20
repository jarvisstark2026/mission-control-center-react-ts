import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
