import { test as runner, expect } from '@playwright/test';
import { launchSafari, watchDownload } from './native/session.mjs';
import { serveFixture } from './native/fixture-server.mjs';
export { expect, watchDownload };
export const test = runner.extend({
  page: async ({}, use) => {
    const fixture = await serveFixture();
    let browser;
    try {
      browser = await launchSafari(fixture);
      await use(await browser.newPage({ viewport: { width: 1280, height: 720 } }));
    } finally {
      try {
        await browser?.close();
      } finally {
        await fixture.close();
      }
    }
  },
  context: async ({ page }, use) => use(page.context()),
});
