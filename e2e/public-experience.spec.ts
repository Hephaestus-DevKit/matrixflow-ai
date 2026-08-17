import { expect, test } from '@playwright/test';

test('server-renders the persisted locale before hydration', async ({ context }) => {
  await context.addCookies([
    { name: 'matrixflow-locale', value: 'en', domain: '127.0.0.1', path: '/' },
  ]);
  const response = await context.request.get('/');
  const body = await response.text();
  expect(response.status()).toBe(200);
  expect(body).toMatch(/<html\b[^>]*\blang=["']en["']/i);
  expect(body).toContain('Built for cross-border commerce · AI workforce OS');
  expect(body).toContain('<title>MatrixFlow AI — AI Workforce OS</title>');
});

test('switches among all three locales and persists the choice', async ({ page }) => {
  await page.goto('/');
  const locale = page.locator('header select');

  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page).toHaveTitle(/MatrixFlow AI/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('把跨境运营流程');

  await locale.selectOption('zh-TW');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('把跨境營運流程');

  await locale.selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('MatrixFlow AI — AI Workforce OS');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Put cross-border operations',
  );

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('header select')).toHaveValue('en');

  await page.goto('/pricing');
  await expect(page).toHaveTitle('Pricing | MatrixFlow AI');
});

test('keeps authentication screens in the selected language', async ({ page }) => {
  await page.goto('/');
  await page.locator('header select').selectOption('en');
  await page.goto('/login');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Email code' })).toBeVisible();

  await page.goto('/register');
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('heading', { name: 'Create your AI team' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('does not overflow a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  await expect(page.locator('header select')).toBeVisible();
  await expect(page.getByRole('link', { name: '免费开始', exact: true })).toBeVisible();
});

test('keeps the complete public journey inside the 320px minimum width in every locale', async ({
  page,
}) => {
  test.setTimeout(90_000);
  page.setDefaultNavigationTimeout(60_000);
  await page.setViewportSize({ width: 320, height: 800 });

  for (const locale of ['zh-CN', 'zh-TW', 'en']) {
    await page
      .context()
      .addCookies([{ name: 'matrixflow-locale', value: locale, domain: '127.0.0.1', path: '/' }]);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', locale);

    for (const path of ['/', '/pricing', '/login', '/register']) {
      await page.goto(path);
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth, `${locale} ${path} overflowed`).toBeLessThanOrEqual(
        dimensions.clientWidth + 1,
      );
    }
  }
});
