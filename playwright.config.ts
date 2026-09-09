import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: 'output/e2e',
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:5188',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -w @peerbeam/web -- --host 127.0.0.1 --port 5188',
    url: 'http://127.0.0.1:5188',
    reuseExistingServer: false,
    env: { VITE_SIGNALING_URL: 'ws://127.0.0.1:8099', VITE_STUN_URL: '' },
  },
});
