import { expect, test, type Page } from '@playwright/test';

async function chooseLocale(page: Page, locale: 'zh-CN' | 'zh-TW' | 'en') {
  await page.getByTestId('locale-switcher-trigger').click();
  await page.getByTestId(`locale-option-${locale}`).click();
}

test('server-renders the persisted locale before hydration', async ({ context }) => {
  await context.addCookies([
    { name: 'matrixflow-locale', value: 'en', domain: '127.0.0.1', path: '/' },
  ]);
  const response = await context.request.get('/');
  const body = await response.text();
  expect(response.status()).toBe(200);
  expect(body).toMatch(/<html\b[^>]*\blang=["']en["']/i);
  expect(body).toContain('AI workforce for cross-border commerce');
  expect(body).toContain('<title>MatrixFlow AI — AI Workforce OS</title>');
});

test('switches among all three locales and persists the choice', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page).toHaveTitle(/MatrixFlow AI/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('把跨境运营流程');

  await chooseLocale(page, 'zh-TW');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('把跨境營運流程');

  await chooseLocale(page, 'en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('MatrixFlow AI — AI Workforce OS');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Put cross-border operations',
  );
  await expect(page.getByRole('heading', { level: 1 })).not.toContainText('operationsin');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByTestId('locale-switcher-trigger')).toHaveAttribute('data-locale', 'en');

  await page.goto('/pricing');
  await expect(page).toHaveTitle('Pricing | MatrixFlow AI');
});

test('keeps authentication screens in the selected language', async ({ page }) => {
  await page.goto('/');
  await chooseLocale(page, 'en');
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
  const headerControls = await page.locator('header a, header button').evaluateAll((controls) =>
    controls
      .map((control) => control.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({ left: rect.left, right: rect.right })),
  );
  for (const control of headerControls) {
    expect(control.left).toBeGreaterThanOrEqual(0);
    expect(control.right).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  }
  const heroHeight = await page
    .locator('main section')
    .first()
    .evaluate((section) => Math.round(section.getBoundingClientRect().height));
  expect(heroHeight).toBeLessThanOrEqual(1150);
  await expect(page.getByTestId('locale-switcher-trigger')).toBeVisible();
  await expect(page.getByRole('link', { name: '免费开始', exact: true })).toBeVisible();
});

test('keeps authentication helper actions touch friendly', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const path of ['/login', '/register']) {
    await page.goto(path);
    const actions = await page.locator('.auth-action-link').evaluateAll((links) =>
      links
        .map((link) => link.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => ({ height: rect.height, width: rect.width })),
    );
    expect(actions.length, `${path} should expose helper actions`).toBeGreaterThan(0);
    for (const action of actions) {
      expect(action.height, `${path} helper action is too short`).toBeGreaterThanOrEqual(32);
      expect(action.width, `${path} helper action is too narrow`).toBeGreaterThanOrEqual(32);
    }
  }
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
        headerControls: [...document.querySelectorAll('header a, header button')]
          .map((control) => control.getBoundingClientRect())
          .filter((rect) => rect.width > 0 && rect.height > 0)
          .map((rect) => ({ left: rect.left, right: rect.right })),
      }));
      expect(dimensions.scrollWidth, `${locale} ${path} overflowed`).toBeLessThanOrEqual(
        dimensions.clientWidth + 1,
      );
      for (const control of dimensions.headerControls) {
        expect(control.left, `${locale} ${path} header left overflowed`).toBeGreaterThanOrEqual(0);
        expect(control.right, `${locale} ${path} header right overflowed`).toBeLessThanOrEqual(
          dimensions.clientWidth + 1,
        );
      }
      if (path === '/' && locale === 'en') {
        const heroHeight = await page
          .locator('main section')
          .first()
          .evaluate((section) => Math.round(section.getBoundingClientRect().height));
        expect(heroHeight, 'English 320px hero is too vertically heavy').toBeLessThanOrEqual(1250);
      }
    }
  }
});
