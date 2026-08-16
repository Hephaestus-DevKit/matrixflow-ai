import { expect, test } from '@playwright/test';

test('protected dashboard routes fail closed to the localized login screen', async ({ page }) => {
  await page.goto('/');
  await page.locator('header select').selectOption('en');
  for (const path of ['/dashboard', '/dashboard/settings', '/dashboard/knowledge']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  }
});

test('unknown routes render the localized not-found experience', async ({ page }) => {
  await page.goto('/');
  await page.locator('header select').selectOption('zh-TW');
  await page.goto('/does-not-exist');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('這個頁面不存在');
});
