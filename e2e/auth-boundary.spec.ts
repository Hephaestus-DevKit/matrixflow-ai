import { expect, test, type Page } from '@playwright/test';

async function chooseLocale(page: Page, locale: 'zh-CN' | 'zh-TW' | 'en') {
  await page.getByTestId('locale-switcher-trigger').click();
  await page.getByTestId(`locale-option-${locale}`).click();
}

test('protected dashboard routes fail closed to the localized login screen', async ({ page }) => {
  await page.goto('/');
  await chooseLocale(page, 'en');
  for (const path of ['/dashboard', '/dashboard/settings', '/dashboard/knowledge']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  }
});

test('unknown routes render the localized not-found experience', async ({ page }) => {
  await page.goto('/');
  await chooseLocale(page, 'zh-TW');
  await page.goto('/does-not-exist');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('這個頁面不存在');
});
