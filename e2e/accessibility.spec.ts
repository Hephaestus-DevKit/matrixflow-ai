import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const publicPaths = ['/', '/pricing', '/login', '/register'];

test('public product journey has no serious WCAG violations', async ({ page, context }) => {
  test.setTimeout(90_000);
  await context.addCookies([
    { name: 'matrixflow-locale', value: 'en', domain: '127.0.0.1', path: '/' },
  ]);

  for (const path of publicPaths) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );
    expect(
      blocking,
      `${path} has blocking accessibility violations:\n${blocking
        .map((violation) => `${violation.id}: ${violation.help}`)
        .join('\n')}`,
    ).toEqual([]);
  }
});

test('landing page remains accessible in all supported locales', async ({ page, context }) => {
  for (const locale of ['zh-CN', 'zh-TW', 'en']) {
    await context.addCookies([
      { name: 'matrixflow-locale', value: locale, domain: '127.0.0.1', path: '/' },
    ]);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    const results = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(
      results.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious',
      ),
      `${locale} landing page has blocking accessibility violations`,
    ).toEqual([]);
  }
});
