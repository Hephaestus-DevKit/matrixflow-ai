import type { Page, Route } from '@playwright/test';
import { expect, test, watchDownload } from './safari';

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

test('a locale cookie wins over stale localStorage during hydration', async ({ page, context }) => {
  await context.addCookies([
    { name: 'matrixflow-locale', value: 'zh-TW', domain: '127.0.0.1', path: '/' },
  ]);
  await context.addInitScript(() => localStorage.setItem('matrixflow-locale', 'en'));
  await page.goto('/');
  await expect
    .poll(() => page.getByRole('heading', { level: 1 }).innerText())
    .toContain('把跨境營運流程');
  await expect.poll(() => page.locator('html').getAttribute('lang')).toBe('zh-TW');
  expect(
    (await context.cookies()).find((cookie) => cookie.name === 'matrixflow-locale')?.value,
  ).toBe('zh-TW');
});

test('locale switching works when browser privacy settings block localStorage', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Storage disabled', 'SecurityError');
      },
    });
  });
  await page.goto('/');
  await chooseLocale(page, 'en');
  await page.reload();
  await expect
    .poll(() => page.getByRole('heading', { level: 1 }).innerText())
    .toContain('Put cross-border operations');
  await expect.poll(() => page.locator('html').getAttribute('lang')).toBe('en');
  expect(await page.errors()).toEqual([]);
});

test('switches among all three locales and persists the choice', async ({ page }) => {
  await page.goto('/');

  await expect.poll(() => page.locator('html').getAttribute('lang')).toBe('zh-CN');
  await expect.poll(() => page.title()).toMatch(/MatrixFlow AI/);
  await expect
    .poll(() => page.getByRole('heading', { level: 1 }).innerText())
    .toContain('把跨境运营流程');

  await chooseLocale(page, 'zh-TW');
  await expect.poll(() => page.locator('html').getAttribute('lang')).toBe('zh-TW');
  await expect
    .poll(() => page.getByRole('heading', { level: 1 }).innerText())
    .toContain('把跨境營運流程');

  await chooseLocale(page, 'en');
  await expect.poll(() => page.locator('html').getAttribute('lang')).toBe('en');
  await expect.poll(() => page.title()).toBe('MatrixFlow AI — AI Workforce OS');
  await expect
    .poll(() => page.getByRole('heading', { level: 1 }).innerText())
    .toContain('Put cross-border operations');
  await expect
    .poll(() => page.getByRole('heading', { level: 1 }).innerText())
    .not.toContain('operationsin');

  await page.reload();
  await expect.poll(() => page.locator('html').getAttribute('lang')).toBe('en');
  await expect
    .poll(() => page.getByTestId('locale-switcher-trigger').getAttribute('data-locale'))
    .toBe('en');

  await page.goto('/pricing');
  await expect.poll(() => page.title()).toBe('Pricing | MatrixFlow AI');
});

test('keeps authentication screens in the selected language', async ({ page }) => {
  await page.goto('/');
  await chooseLocale(page, 'en');
  await page.goto('/login');

  await expect.poll(() => page.url()).toMatch(/\/login$/);
  await expect
    .poll(() => page.getByRole('heading', { name: 'Welcome back' }).isVisible())
    .toBe(true);
  await expect.poll(() => page.getByLabel('Email').isVisible()).toBe(true);
  await expect.poll(() => page.getByLabel('Password', { exact: true }).isVisible()).toBe(true);
  await expect.poll(() => page.getByRole('button', { name: 'Email code' }).isVisible()).toBe(true);

  await page.goto('/register');
  await expect.poll(() => page.url()).toMatch(/\/register$/);
  await expect
    .poll(() => page.getByRole('heading', { name: 'Create your AI team' }).isVisible())
    .toBe(true);
  await expect.poll(() => page.locator('html').getAttribute('lang')).toBe('en');
});

test('does not overflow a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect.poll(() => page.getByRole('heading', { level: 1 }).isVisible()).toBe(true);

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
  await expect.poll(() => page.getByTestId('locale-switcher-trigger').isVisible()).toBe(true);
  await expect
    .poll(() => page.getByRole('link', { name: '免费开始', exact: true }).isVisible())
    .toBe(true);
});

test('keeps structured motion expressive on desktop and quiet on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');

  const desktop = await page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>('.landing-grid');
    const sweep = document.querySelector<HTMLElement>('.landing-sweep');
    return {
      width: innerWidth,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      highContrast: matchMedia('(prefers-contrast: more)').matches,
      gridOpacity: Number.parseFloat(getComputedStyle(grid!).opacity),
      gridAnimation: getComputedStyle(grid!).animationName,
      sweepDisplay: getComputedStyle(sweep!).display,
      sweepAnimation: getComputedStyle(sweep!).animationName,
    };
  });
  expect(desktop.gridOpacity).toBeGreaterThan(0);
  expect(desktop.gridAnimation).toContain('landing-grid-drift');
  expect(desktop.sweepDisplay, JSON.stringify(desktop)).not.toBe('none');
  expect(desktop.sweepAnimation).toContain('landing-sweep-drift');

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>('.landing-grid');
    const sweep = document.querySelector<HTMLElement>('.landing-sweep');
    return {
      gridAnimation: getComputedStyle(grid!).animationName,
      sweepDisplay: getComputedStyle(sweep!).display,
    };
  });
  expect(mobile.gridAnimation).toBe('none');
  expect(mobile.sweepDisplay).toBe('none');
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
      expect(action.height + 0.01, `${path} helper action is too short`).toBeGreaterThanOrEqual(44);
      expect(action.width + 0.01, `${path} helper action is too narrow`).toBeGreaterThanOrEqual(44);
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
    await expect.poll(() => page.locator('html').getAttribute('lang')).toBe(locale);

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

test('narrow English hero remains readable with fallback system fonts', async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: 'matrixflow-locale', value: 'en', domain: '127.0.0.1', path: '/' },
  ]);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  await page.addStyleTag({
    content: ':root { --font-sans: Arial, sans-serif; --font-display: Arial, sans-serif; }',
  });
  const layout = await page.locator('.landing-hero').evaluate((hero) => ({
    height: hero.getBoundingClientRect().height,
    headingSize: Number.parseFloat(getComputedStyle(hero.querySelector('h1')!).fontSize),
  }));
  expect(layout.height).toBeLessThanOrEqual(1250);
  expect(layout.headingSize).toBeGreaterThanOrEqual(26);
  await expect.poll(() => page.locator('.landing-primary-action').first().inViewport()).toBe(true);
});
