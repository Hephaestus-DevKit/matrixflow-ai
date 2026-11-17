import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { mockWorkspace } from './fixtures/workspace';

for (const width of [1360, 390]) {
  test(`review and export at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 820 });
    await mockWorkspace(page);
    await page.goto('/dashboard/content?project=project-1');
    const editor = page.getByLabel('Edit draft').first();
    const confirmation = page.getByLabel('I checked product facts, claims and sources').first();
    const download = page.getByRole('button', { name: 'Download', exact: true });
    await editor.fill(' ');
    await expect(confirmation).toBeDisabled();
    await editor.fill('Reviewed product facts');
    await confirmation.check();
    await editor.fill('Final reviewed product facts');
    await expect(download).toHaveCount(0);
    await confirmation.check();
    await download.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    const event = page.waitForEvent('download');
    await download.click();
    const file = await event;
    expect(await readFile((await file.path())!, 'utf8')).toBe('Final reviewed product facts');
    await page.screenshot({ path: info.outputPath('review.png') });
  });
}
