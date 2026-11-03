import { defineConfig } from '@playwright/test';

const port = Number(process.env['TRACKER_TEST_PORT'] ?? 8100);

export default defineConfig({
  testDir: './tests/ui',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm start -- --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
    timeout: 90000,
  },
});
