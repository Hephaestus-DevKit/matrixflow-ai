import type { Page, Route } from '@playwright/test';
import { expect, test, watchDownload } from './safari';

async function chooseLocale(page: Page, locale: 'zh-CN' | 'zh-TW' | 'en') {
  await page.getByTestId('locale-switcher-trigger').click();
  await page.getByTestId(`locale-option-${locale}`).click();
}

test('protected dashboard routes fail closed to the localized login screen', async ({ page }) => {
  await page.route('http://127.0.0.1:3102/v1/**', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ code: 401, type: 'user_unauthorized', message: 'No active session' }),
    });
  });
  await page.goto('/');
  await chooseLocale(page, 'en');
  for (const path of [
    '/dashboard',
    '/dashboard/settings',
    '/dashboard/knowledge',
    '/dashboard/jobs',
  ]) {
    await page.goto(path);
    await expect.poll(() => page.url()).toMatch(/\/login(?:\?next=.+)?$/);
    await expect
      .poll(() => page.getByRole('heading', { name: 'Welcome back' }).isVisible())
      .toBe(true);
    await expect.poll(() => page.locator('html').getAttribute('lang')).toBe('en');
  }
});

test('unknown routes render the localized not-found experience', async ({ page }) => {
  await page.goto('/');
  await chooseLocale(page, 'zh-TW');
  await page.goto('/does-not-exist');
  await expect.poll(() => page.locator('html').getAttribute('lang')).toBe('zh-TW');
  await expect
    .poll(() => page.getByRole('heading', { level: 1 }).innerText())
    .toContain('這個頁面不存在');
});

test('password recovery removes reset credentials from the address bar', async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: 'matrixflow-locale', value: 'en', domain: '127.0.0.1', path: '/' },
  ]);
  await page.goto('/recover?userId=user-1&secret=one-time-secret');
  await expect.poll(() => page.url()).toMatch(/\/recover$/);
  await expect.poll(() => page.getByLabel('New password', { exact: true }).isVisible()).toBe(true);
});
