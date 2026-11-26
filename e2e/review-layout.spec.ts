import { expect, test, watchDownload } from './safari';
import { mockWorkspace } from './fixtures/workspace';

for (const width of [1360, 390, 320]) {
  test(`review and export at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 820 });
    await mockWorkspace(page);
    await page.goto('/dashboard/content?project=project-1');
    const editor = page.getByLabel('Edit draft').first();
    const confirmation = page.getByRole('button', { name: 'Approve draft', exact: true });
    const download = page.getByRole('button', { name: 'Download', exact: true });
    await editor.fill(' ');
    await expect.poll(() => confirmation.enabled()).toBe(false);
    await editor.fill('Reviewed product facts');
    const actionsShareRow = await page.evaluate(() => {
      const actions = Array.from(document.querySelectorAll('main button'));
      const save = actions.find((button) => button.textContent?.trim() === 'Save draft');
      const approve = actions.find((button) => button.textContent?.trim() === 'Approve draft');
      return Boolean(
        save &&
        approve &&
        Math.abs(save.getBoundingClientRect().top - approve.getBoundingClientRect().top) < 2,
      );
    });
    expect(actionsShareRow).toBe(true);
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect
      .poll(() => page.getByRole('button', { name: 'Save draft', exact: true }).enabled())
      .toBe(false);
    expect(await download.count()).toBe(0);
    await confirmation.click();
    await expect.poll(() => download.isVisible()).toBe(true);
    await editor.fill('Final reviewed product facts');
    await expect.poll(() => download.count()).toBe(0);
    await confirmation.click();
    await download.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    const event = await watchDownload(page, '.txt');
    await download.click();
    const file = await event();
    expect((await file.read()).toString('utf8')).toBe('Final reviewed product facts');
    await page.screenshot({ path: info.outputPath('review.png') });
    await page.getByRole('button', { name: 'Revoke approval', exact: true }).click();
    await expect.poll(() => download.count()).toBe(0);
    await expect.poll(() => confirmation.isVisible()).toBe(true);
  });
}
