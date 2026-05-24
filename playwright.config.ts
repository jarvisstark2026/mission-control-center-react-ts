import { defineConfig, devices } from '@playwright/test';

const nodeCommand = JSON.stringify(process.execPath);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: `${nodeCommand} ./node_modules/vite/bin/vite.js --host 127.0.0.1`,
    url: 'http://127.0.0.1:5173/?role=admin',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
