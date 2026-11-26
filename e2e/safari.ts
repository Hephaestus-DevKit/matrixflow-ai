import { test as runner, expect } from '@playwright/test';
import { launchSafari, watchDownload } from './native/session.mjs';
import { serveFixture } from './native/fixture-server.mjs';
export { expect, watchDownload };
export const test = runner.extend({
  page: async ({}, use, info) => {
    const fixture = await serveFixture();
    let browser;
    try {
      browser = await launchSafari(fixture);
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await use(page);
      if (info.status !== info.expectedStatus) {
        const path = info.outputPath('safari-failure.png');
        try {
          await page.screenshot({ path });
          await info.attach('Safari screenshot', { path, contentType: 'image/png' });
        } catch {
          // A lost WebDriver session cannot produce a screenshot.
        }
      }
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
