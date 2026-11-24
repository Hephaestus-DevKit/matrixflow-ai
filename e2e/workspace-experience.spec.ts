import { readFile } from 'node:fs/promises';
import { expect, test, watchDownload } from './safari';
import { mockWorkspace } from './fixtures/workspace';

test('content uses latest saved outputs and user-selected language, market and tone', async ({
  page,
}) => {
  const { calls } = await mockWorkspace(page);
  await page.goto('/dashboard/content');
  await page.getByRole('button', { name: 'Travel bag', exact: true }).click();
  await expect.poll(() => page.getByLabel('Edit draft').first().value()).toBe('Newest saved title');
  await expect.poll(() => page.getByText('Older saved title', { exact: true }).count()).toBe(0);
  await page.getByLabel('Output language').selectOption('de');
  await page.getByLabel('Target market').fill('Germany / Amazon');
  await page.getByLabel('Tone and audience').fill('Clear and practical');
  await page.getByRole('button', { name: 'Regenerate', exact: true }).first().click();
  await expect
    .poll(() => page.getByLabel('Edit draft').first().value())
    .toBe('Generated German title');
  await expect
    .poll(() => page.getByRole('button', { name: 'Download', exact: true }).count())
    .toBe(0);
  await page.getByLabel('I checked product facts, claims and sources').first().check();
  await page.getByLabel('Edit draft').first().fill('Reviewed German title');
  await expect
    .poll(() => page.getByRole('button', { name: 'Download', exact: true }).count())
    .toBe(0);
  await page.getByLabel('I checked product facts, claims and sources').first().check();
  expect(calls.find((call) => call.path.endsWith('/generate'))?.body).toMatchObject({
    language: 'de',
    variables: { targetMarket: 'Germany / Amazon', tone: 'Clear and practical' },
  });
  const downloadEvent = await watchDownload(page, '.txt');
  await page.getByRole('button', { name: 'Download', exact: true }).first().click();
  const download = await downloadEvent();
  expect(download.name).toBe('product_title-fresh-title.txt');
  expect((await download.read()).toString('utf8')).toBe('Reviewed German title');
});

test('content batches run durably and report partial success', async ({ page }) => {
  const { calls } = await mockWorkspace(page);
  await page.goto('/dashboard/content?project=project-1');
  await page.getByRole('button', { name: /Generate all/ }).click();
  await expect.poll(() => page.getByRole('link', { name: 'View task' }).isVisible()).toBe(true);
  await expect
    .poll(() => page.getByText(/Some content could not be generated/).isVisible())
    .toBe(true);
  expect(calls.find((call) => call.path.endsWith('/generate-all'))?.body.mode).toBe('async');
  await page.getByRole('link', { name: 'View task' }).click();
  await expect
    .poll(() => page.getByRole('heading', { name: 'Task details' }).isVisible(), {
      timeout: 15_000,
    })
    .toBe(true);
  await expect
    .poll(() => page.getByText('Generated listing', { exact: false }).first().isVisible())
    .toBe(true);
});

test('switching content projects keeps the running task attached to its project', async ({
  page,
}) => {
  await mockWorkspace(page, { keepJobsRunning: true, extraContentProject: true });
  await page.goto('/dashboard/content?project=project-1');
  const generateAll = page.getByRole('button', { name: /Generate all/ });
  const viewTask = page.getByRole('link', { name: 'View task' });
  await generateAll.click();
  await expect.poll(() => viewTask.isVisible()).toBe(true);

  const travelBag = page.getByRole('button', { name: 'Travel bag', exact: true });
  await travelBag.click();
  await expect.poll(() => viewTask.isVisible()).toBe(true);
  await expect.poll(() => generateAll.enabled()).toBe(false);

  await page.getByRole('button', { name: 'Laptop sleeve', exact: true }).click();
  await expect.poll(() => viewTask.count()).toBe(0);
  await expect.poll(() => generateAll.enabled()).toBe(true);
  await expect.poll(() => page.getByLabel('Edit draft').count()).toBe(0);

  await travelBag.click();
  await expect.poll(() => viewTask.isVisible()).toBe(true);
  await expect.poll(() => generateAll.enabled()).toBe(false);
  await expect.poll(() => page.getByLabel('Edit draft').first().value()).toBe('Newest saved title');
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
  await expect
    .poll(() => page.getByRole('button', { name: 'Save configuration', exact: true }).count())
    .toBe(0);
  expect(calls.find((call) => call.method === 'PATCH')?.body.knowledgeBaseId).toBe('kb-1');
  await page.getByLabel('Task to run').fill('What is the bag capacity?');
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await page.getByRole('link', { name: 'View task' }).click();
  await expect
    .poll(() => page.getByText('Grounded answer: capacity is 20 liters [资料 1].').isVisible())
    .toBe(true);
  await page.getByText('Sources (1)', { exact: true }).click();
  await expect
    .poll(() => page.getByText('Capacity: 20 liters', { exact: true }).isVisible())
    .toBe(true);
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
  await expect.poll(() => page.getByRole('link', { name: 'View task' }).isVisible()).toBe(true);
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
  await expect.poll(() => page.getByLabel('Edit draft').first().value()).toBe('Newest saved title');
  await page.getByLabel('Target market').fill('Private market brief');
  await page.getByLabel('Team workspace').selectOption('team-2');
  await expect.poll(() => page.getByText('Newest saved title', { exact: true }).count()).toBe(0);
  await expect.poll(() => page.getByLabel('Target market').count()).toBe(0);
  await expect
    .poll(() => page.getByRole('button', { name: 'Travel bag', exact: true }).count())
    .toBe(0);
});

test('slow authentication keeps the requested resource instead of redirecting to login', async ({
  page,
}) => {
  await mockWorkspace(page, { slowIdentity: true });
  await page.goto('/dashboard/agents/agent-1');
  await expect
    .poll(() => page.getByRole('heading', { name: 'Support worker', exact: true }).isVisible())
    .toBe(true);
  await expect.poll(() => page.url()).toMatch(/\/dashboard\/agents\/agent-1$/);
});

test('network failures offer retry without discarding the requested route', async ({ page }) => {
  await mockWorkspace(page, { identityUnavailable: true });
  await page.goto('/dashboard/content');
  await expect
    .poll(() => page.getByRole('button', { name: 'Reload', exact: true }).isVisible(), {
      timeout: 15_000,
    })
    .toBe(true);
  await expect.poll(() => page.url()).toMatch(/\/dashboard\/content$/);
});

test('content workspace is accessible and mobile actions do not overflow', async ({ page }) => {
  await mockWorkspace(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard/content');
  await page.getByRole('button', { name: 'Travel bag', exact: true }).click();
  const results = await page.audit(['wcag2a', 'wcag2aa'], 'main');
  expect(
    results.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact || ''),
    ),
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: /Delete.*Travel bag/ }).click();
  await expect
    .poll(() =>
      page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).focused(),
    )
    .toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.getByRole('alertdialog').count()).toBe(0);
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
  await expect
    .poll(() => page.getByText('Capacity is 20 liters.', { exact: true }).isVisible())
    .toBe(true);
  await expect
    .poll(() => page.getByText('Capacity: 20 liters', { exact: false }).first().isVisible())
    .toBe(true);
  expect(calls.find((call) => call.path.endsWith('/ask'))?.body.mode).toBe('async');
});

test('an active worker task can be canceled from its progress card', async ({ page }) => {
  const { calls } = await mockWorkspace(page, { keepJobsRunning: true });
  await page.goto('/dashboard/agents/agent-1');
  await page.getByLabel('Task to run').fill('Draft a product support answer');
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel task', exact: true }).click();
  await expect.poll(() => page.getByText('Task canceled', { exact: true }).isVisible()).toBe(true);
  expect(calls.find((call) => call.path.endsWith('/cancel'))?.body.reason).toBe('user_requested');
});

test('new users can start with sample facts and associate a knowledge base', async ({ page }) => {
  const { calls } = await mockWorkspace(page);
  await page.goto('/dashboard/content');
  await page.getByRole('button', { name: 'Try sample product' }).click();
  await expect.poll(() => page.locator('#projName').value()).toBe('Travel bag');
  await page.getByLabel('Knowledge base (optional)').selectOption('kb-1');
  await page.getByRole('button', { name: 'Create now', exact: true }).click();
  await expect
    .poll(
      () => calls.find((call) => call.path === '/content/projects' && call.method === 'POST')?.body,
    )
    .toMatchObject({ productData: { knowledgeBaseId: 'kb-1', title: 'Travel bag' } });
});
