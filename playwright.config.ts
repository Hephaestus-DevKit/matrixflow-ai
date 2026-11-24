import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
  },
  projects: [{ name: 'safari' }],
  webServer: {
    command: 'pnpm --filter @matrixflow/web exec next dev --turbopack -H 127.0.0.1 -p 3101',
    url: 'http://127.0.0.1:3101',
    env: {
      NEXT_PUBLIC_APPWRITE_ENDPOINT: 'http://127.0.0.1:3102/v1',
      NEXT_PUBLIC_APPWRITE_PROJECT_ID: 'matrixflow-safari-fixture',
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
