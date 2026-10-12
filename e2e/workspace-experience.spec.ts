import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockWorkspace } from './fixtures/workspace';

test('content uses latest saved outputs and user-selected language, market and tone', async ({
  page,
}) => {
  const { calls } = await mockWorkspace(page);
  await page.goto('/dashboard/content');
  await page.getByRole('button', { name: 'Travel bag', exact: true }).click();
  await expect(page.getByText('Newest saved title', { exact: true })).toBeVisible();
  await expect(page.getByText('Older saved title', { exact: true })).toHaveCount(0);
  await page.getByLabel('Output language').selectOption('de');
  await page.getByLabel('Target market').fill('Germany / Amazon');
  await page.getByLabel('Tone and audience').fill('Clear and practical');
  await page.getByRole('button', { name: 'Regenerate', exact: true }).first().click();
  await expect(page.getByText('Generated German title', { exact: true })).toBeVisible();
  expect(calls.find((call) => call.path.endsWith('/generate'))?.body).toMatchObject({
    language: 'de',
    variables: { targetMarket: 'Germany / Amazon', tone: 'Clear and practical' },
  });
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download', exact: true }).first().click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('product_title-fresh-title.txt');
});

test('content batches run durably and report partial success', async ({ page }) => {
  const { calls } = await mockWorkspace(page);
  await page.goto('/dashboard/content?project=project-1');
  await page.getByRole('button', { name: /Generate all/ }).click();
  await expect(page.getByRole('link', { name: 'View task' })).toBeVisible();
  await expect(page.getByText(/Some content could not be generated/)).toBeVisible();
  expect(calls.find((call) => call.path.endsWith('/generate-all'))?.body.mode).toBe('async');
  await page.getByRole('link', { name: 'View task' }).click();
  await expect(page.getByRole('heading', { name: 'Task details' })).toBeVisible();
  await expect(page.getByText('Generated listing', { exact: false }).first()).toBeVisible();
});

test('worker configuration links a knowledge base and async results survive navigation', async ({
  page,
}) => {
  const { calls } = await mockWorkspace(page);
  await page.goto('/dashboard/agents/agent-1');
  await page.getByRole('button', { name: 'Edit configuration', exact: true }).click();
  await page.getByLabel('Reference knowledge base').selectOption('kb-1');
  await page
    .getByLabel('Instructions', { exact: true })
    .fill('Answer only using the linked product handbook.');
  await page.getByRole('button', { name: 'Save configuration', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save configuration', exact: true })).toHaveCount(
    0,
  );
  expect(calls.find((call) => call.method === 'PATCH')?.body.knowledgeBaseId).toBe('kb-1');
  await page.getByLabel('Task to run').fill('What is the bag capacity?');
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await page.getByRole('link', { name: 'View task' }).click();
  await expect(page.getByText('Grounded answer: capacity is 20 liters [资料 1].')).toBeVisible();
  await page.getByText('Sources (1)', { exact: true }).click();
  await expect(page.getByText('Capacity: 20 liters', { exact: true })).toBeVisible();
  expect(calls.find((call) => call.path.endsWith('/run'))?.body.mode).toBe('async');
});

test('workflow run saves the visible graph and accepts runtime input', async ({ page }) => {
  const { calls } = await mockWorkspace(page);
  await page.goto('/dashboard/workflows/workflow-1');
  await page.getByText('Run input (JSON object)', { exact: true }).click();
  await page
    .getByLabel('Run input (JSON object)', { exact: true })
    .fill('{"product":"Travel bag"}');
  await page.getByRole('button', { name: 'Save and run', exact: true }).click();
  await expect(page.getByRole('link', { name: 'View task' })).toBeVisible();
  const saved = calls.findIndex((call) => call.path.endsWith('/versions'));
  const run = calls.findIndex((call) => call.path.endsWith('/run'));
  expect(saved).toBeGreaterThanOrEqual(0);
  expect(run).toBeGreaterThan(saved);
  expect(calls[run].body).toMatchObject({ mode: 'async', input: { product: 'Travel bag' } });
});

test('team switching clears previous inputs and results before showing the new workspace', async ({
  page,
}) => {
  await mockWorkspace(page);
  await page.goto('/dashboard/content');
  await page.getByRole('button', { name: 'Travel bag', exact: true }).click();
  await expect(page.getByText('Newest saved title', { exact: true })).toBeVisible();
  await page.getByLabel('Target market').fill('Private market brief');
  await page.getByLabel('Team workspace').selectOption('team-2');
  await expect(page.getByText('Newest saved title', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Target market')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Travel bag', exact: true })).toHaveCount(0);
});

test('slow authentication keeps the requested resource instead of redirecting to login', async ({
  page,
}) => {
  await mockWorkspace(page, { slowIdentity: true });
  await page.goto('/dashboard/agents/agent-1');
  await expect(page.getByRole('heading', { name: 'Support worker', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/agents\/agent-1$/);
});

test('network failures offer retry without discarding the requested route', async ({ page }) => {
  await mockWorkspace(page, { identityUnavailable: true });
  await page.goto('/dashboard/content');
  await expect(page.getByRole('button', { name: 'Reload', exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page).toHaveURL(/\/dashboard\/content$/);
});

test('content workspace is accessible and mobile actions do not overflow', async ({ page }) => {
  await mockWorkspace(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard/content');
  await page.getByRole('button', { name: 'Travel bag', exact: true }).click();
  const results = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(
    results.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact || ''),
    ),
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: /Delete.*Travel bag/ }).click();
  await expect(
    page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('knowledge answers run in the background and retain cited source material', async ({
  page,
}) => {
  const { calls } = await mockWorkspace(page);
  await page.goto('/dashboard/knowledge/kb-1');
  await page
    .getByRole('textbox', { name: 'RAG Q&A', exact: true })
    .fill('What is the bag capacity?');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.getByText('Capacity is 20 liters.', { exact: true })).toBeVisible();
  await expect(page.getByText('Capacity: 20 liters', { exact: false }).first()).toBeVisible();
  expect(calls.find((call) => call.path.endsWith('/ask'))?.body.mode).toBe('async');
});

test('an active worker task can be canceled from its progress card', async ({ page }) => {
  const { calls } = await mockWorkspace(page, { keepJobsRunning: true });
  await page.goto('/dashboard/agents/agent-1');
  await page.getByLabel('Task to run').fill('Draft a product support answer');
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel task', exact: true }).click();
  await expect(page.getByText('Task canceled', { exact: true })).toBeVisible();
  expect(calls.find((call) => call.path.endsWith('/cancel'))?.body.reason).toBe('user_requested');
});
