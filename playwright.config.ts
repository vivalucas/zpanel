import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, retries: 0,
  timeout: 30_000, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:16521', viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'node scripts/e2e-server.mjs', url: 'http://127.0.0.1:16521/api/healthz', timeout: 120_000, reuseExistingServer: false },
})
