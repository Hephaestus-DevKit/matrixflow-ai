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
  await page.getByText('Generation settings', { exact: true }).click();
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
  await page.getByRole('button', { name: 'Approve draft', exact: true }).click();
  await expect
    .poll(() => page.getByRole('button', { name: 'Revoke approval', exact: true }).isVisible())
    .toBe(true);
  await page.getByLabel('Edit draft').first().fill('Reviewed German title');
  await expect
    .poll(() => page.getByRole('button', { name: 'Download', exact: true }).count())
    .toBe(0);
  await page.getByRole('button', { name: 'Approve draft', exact: true }).click();
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
  await page.getByText('Generation settings', { exact: true }).click();
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

test('switching projects preserves draft edits and a running generation', async ({ page }) => {
  await mockWorkspace(page, { extraContentProject: true, keepJobsRunning: true });
  await page.goto('/dashboard/content');
  const travelBag = page.getByRole('button', { name: 'Travel bag', exact: true });
  const sleeve = page.getByRole('button', { name: 'Laptop sleeve', exact: true });
  const editor = page.getByLabel('Edit draft').first();
  const generate = page.locator('#generate-content-batch');
  const viewTask = page.getByRole('link', { name: 'View task' });
  const download = page.getByRole('button', { name: 'Download', exact: true });

  await travelBag.click();
  await expect.poll(() => editor.value()).toBe('Newest saved title');
  await expect.poll(() => page.url()).toMatch(/\?project=project-1$/);
  await editor.fill('Reviewed travel bag title');
  await page.getByRole('button', { name: 'Approve draft', exact: true }).click();
  await page.getByText('Generation settings', { exact: true }).click();
  await generate.click();
  await expect.poll(() => viewTask.isVisible()).toBe(true);

  await page.getByText('Switch project', { exact: true }).click();
  await sleeve.click();
  await expect.poll(() => page.getByLabel('Edit draft').count()).toBe(0);
  await expect.poll(() => viewTask.count()).toBe(0);
  await expect.poll(() => generate.enabled()).toBe(true);

  await page.evaluate(() => window.history.back());
  await expect.poll(() => editor.value()).toBe('Reviewed travel bag title');
  await expect.poll(() => download.isVisible()).toBe(true);
  await expect.poll(() => viewTask.isVisible()).toBe(true);
  await expect.poll(() => generate.enabled()).toBe(false);

  await viewTask.click();
  await expect
    .poll(() => page.getByRole('heading', { name: 'Task details' }).isVisible())
    .toBe(true);
  await page.evaluate(() => window.history.back());
  await expect.poll(() => viewTask.isVisible()).toBe(true);
  await expect.poll(() => generate.enabled()).toBe(false);

  await page.reload();
  await expect.poll(() => editor.value()).toBe('Reviewed travel bag title');
  await expect
    .poll(() => page.getByRole('heading', { name: 'Travel bag', exact: true }).isVisible())
    .toBe(true);
});

test('a project deep link opens a project outside the first result page', async ({ page }) => {
  await mockWorkspace(page, { paginatedContentProjects: true });
  await page.goto('/dashboard/content?project=packing-cubes');
  const project = page.getByRole('button', { name: 'Packing cubes', exact: true });
  const heading = page.getByRole('heading', { name: 'Packing cubes', exact: true });
  await expect.poll(() => heading.isVisible()).toBe(true);
  await page.getByText('Switch project', { exact: true }).click();
  await expect.poll(() => project.count()).toBe(0);
  await page
    .getByRole('navigation', { name: 'Pagination' })
    .getByRole('button', { name: 'Next' })
    .click();
  await expect.poll(() => project.getAttribute('aria-current')).toBe('true');
  await expect.poll(() => heading.isVisible()).toBe(true);
});

test('browser history restores the project creation form', async ({ page }) => {
  await mockWorkspace(page);
  await page.goto('/dashboard/content?project=project-1');
  const projectName = page.getByLabel('Project name');
  const openForm = page.getByRole('button', { name: 'New project', exact: true });
  await page.getByText('Switch project', { exact: true }).click();
  await openForm.click();
  await expect.poll(() => page.url()).toMatch(/[?&]create=1/);
  await projectName.fill('Packing cubes');
  await page.evaluate(() => window.history.back());
  await expect.poll(() => projectName.count()).toBe(0);
  await expect.poll(() => page.url()).toMatch(/\?project=project-1$/);

  await page.evaluate(() => window.history.forward());
  await expect.poll(() => projectName.value()).toBe('Packing cubes');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect.poll(() => projectName.count()).toBe(0);
  await expect.poll(() => page.url()).toMatch(/\?project=project-1$/);
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
  await page.getByText('Sources (1)', { exact: true }).evaluate((element) => {
    if (element instanceof HTMLElement) element.focus();
  });
  await page.keyboard.press('Enter');
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
  await page.getByText('Generation settings', { exact: true }).click();
  await page.getByLabel('Target market').fill('Private market brief');
  const switcher = page.getByRole('button', { name: 'Team workspace: Team One', exact: true });
  const teams = page.getByRole('listbox', { name: 'Team workspace', exact: true });
  await switcher.click();
  await expect
    .poll(() =>
      teams.getByRole('option', { name: 'Team One', exact: true }).getAttribute('aria-selected'),
    )
    .toBe('true');
  await page.keyboard.press('Escape');
  await expect.poll(() => switcher.getAttribute('aria-expanded')).toBe('false');
  await expect
    .poll(() => switcher.evaluate((element) => element === document.activeElement))
    .toBe(true);
  await switcher.click();
  await teams.getByRole('option', { name: 'Team Two', exact: true }).click();
  await expect
    .poll(() =>
      page.getByRole('button', { name: 'Team workspace: Team Two', exact: true }).isVisible(),
    )
    .toBe(true);
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
  await expect.poll(() => page.getByLabel('Edit draft').value()).toBe('Newest saved title');
  const results = await page.audit(['wcag2a', 'wcag2aa'], 'main');
  expect(
    results.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact || ''),
    ),
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByText('Switch project', { exact: true }).click();
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
  await page.getByLabel('Project name').fill('Spring travel bag');
  await page.getByLabel('Knowledge base (optional)').selectOption('kb-1');
  await page.getByRole('button', { name: 'Create now', exact: true }).click();
  await expect
    .poll(
      () => calls.find((call) => call.path === '/content/projects' && call.method === 'POST')?.body,
    )
    .toMatchObject({ productData: { knowledgeBaseId: 'kb-1', title: 'Spring travel bag' } });
  await expect.poll(() => page.url()).toMatch(/\?project=created-project-2$/);
  await expect.poll(() => page.getByLabel('Project name').count()).toBe(0);
  await page.reload();
  await expect
    .poll(() => page.getByRole('heading', { name: 'Spring travel bag', exact: true }).isVisible())
    .toBe(true);
});

test('compact content workspace shows one draft and preserves edits when switching views', async ({
  page,
}) => {
  await mockWorkspace(page, { extraContentDraft: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard/content?project=project-1');
  const editor = page.getByLabel('Edit draft');
  const format = page.getByRole('combobox', { name: 'Content format', exact: true });
  await expect.poll(() => editor.value()).toBe('Newest saved title');
  await expect.poll(() => editor.count()).toBe(1);
  await expect.poll(() => editor.inViewport()).toBe(true);

  await editor.fill('Revised title');
  await format.selectOption('listing');
  await expect.poll(() => editor.value()).toBe('Travel bag listing');
  await page.getByRole('button', { name: 'Shopify translations' }).click();
  await expect.poll(() => editor.isVisible()).toBe(false);
  await page.getByRole('button', { name: 'Product copy' }).click();
  await expect.poll(() => editor.value()).toBe('Travel bag listing');
  await format.selectOption('product_title');
  await expect.poll(() => editor.value()).toBe('Revised title');
});

test('Shopify field is reviewed, survives reload and exports with its original identifier', async ({
  page,
}) => {
  const { calls } = await mockWorkspace(page);
  await page.goto('/dashboard/content?project=project-1');
  await page.getByRole('button', { name: 'Shopify translations' }).click();
  const csv =
    'Type,Identification,Field,Locale,Market,Status,Default content,Translated content\r\nPRODUCT,000123,title,de,,,Travel bag 23 L,\r\nPRODUCT,000124,title,de,,,Laptop sleeve,\r\n';
  await page
    .getByLabel('Choose CSV')
    .setInputFiles({ name: 'catalog.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByRole('button', { name: 'Import rows' }).click();
  const source = page.getByText('Laptop sleeve', { exact: true });
  const next = page.getByRole('button', { name: 'Next field' });
  await next.click();
  await expect.poll(() => source.isVisible()).toBe(true);
  await expect.poll(() => next.enabled()).toBe(false);
  await page.getByRole('button', { name: 'Previous field' }).click();
  await expect
    .poll(() => page.getByText('Travel bag 23 L', { exact: true }).isVisible())
    .toBe(true);
  await page
    .getByRole('button', { name: 'Translate remaining empty fields', exact: false })
    .click();
  await expect.poll(() => page.url()).toContain('translationJob=translation-job');
  await page.reload();
  await expect
    .poll(() => page.getByText('2 translated, 0 skipped, 0 failed', { exact: true }).isVisible())
    .toBe(true);
  expect(calls.filter((call) => call.path.endsWith('/translate'))).toHaveLength(0);
  const editor = page.getByRole('textbox', { name: 'Translation', exact: true });
  await expect.poll(() => editor.value()).toBe('Reisetasche 23 L');
  await expect.poll(() => editor.enabled()).toBe(true);
  await page.getByRole('button', { name: 'Approve draft', exact: true }).click();
  const download = page.getByRole('button', { name: 'Export approved rows' });
  await expect.poll(() => download.enabled()).toBe(true);
  await page.reload();
  await expect
    .poll(() =>
      page.getByRole('button', { name: 'Shopify translations' }).getAttribute('aria-pressed'),
    )
    .toBe('true');
  await expect.poll(() => download.enabled()).toBe(true);
  const event = await watchDownload(page, '.csv');
  await download.click();
  const exported = (await (await event()).read()).toString('utf8');
  expect(exported).toContain('"000123","title","de","","","Travel bag 23 L","Reisetasche 23 L"');
  expect(exported).not.toContain('000124');
});

test('editing product facts preserves the project and blocks approval of the old copy', async ({
  page,
}) => {
  const { calls } = await mockWorkspace(page);
  await page.goto('/dashboard/content?project=project-1');
  await page.getByRole('button', { name: 'Edit product facts' }).click();
  const facts = page.getByRole('textbox', { name: 'Product facts', exact: true });
  await expect.poll(() => facts.value()).toBe('20 L capacity');
  await facts.fill('24 L capacity');
  await page.getByRole('button', { name: 'Save product facts' }).click();
  const hint = page.getByText(
    'Facts have changed. Regenerate this draft before approving or exporting it.',
  );
  await expect.poll(() => hint.isVisible()).toBe(true);
  await expect
    .poll(() => page.getByRole('button', { name: 'Approve draft', exact: true }).count())
    .toBe(0);
  await page.reload();
  await expect.poll(() => hint.isVisible()).toBe(true);
  const regenerate = page.getByRole('button', { name: 'Regenerate', exact: true });
  await expect.poll(() => regenerate.count()).toBe(1);
  await regenerate.click();
  await expect.poll(() => page.getByLabel('Edit draft').value()).toBe('Generated German title');
  await expect
    .poll(() => page.getByRole('button', { name: 'Approve draft', exact: true }).enabled())
    .toBe(true);
  expect(calls.find((call) => call.path.endsWith('/facts'))?.body).toMatchObject({
    description: '24 L capacity',
    revision: 0,
  });
});

test('desktop copy desk keeps formats and references visible beside the draft', async ({
  page,
}) => {
  await mockWorkspace(page, { extraContentDraft: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/dashboard/content?project=project-1');
  const editor = page.getByRole('textbox', { name: 'Edit draft', exact: true });
  await expect.poll(() => editor.value()).toBe('Newest saved title');
  expect(
    await page.getByRole('complementary', { name: 'Review references', exact: true }).count(),
  ).toBe(0);
  expect(await page.getByRole('button', { name: 'TikTok script', exact: true }).isVisible()).toBe(
    false,
  );
  const titleBottom = () =>
    page.evaluate(
      () => document.querySelector('#copy-workspace textarea')?.getBoundingClientRect().bottom,
    );
  const initialBottom = await titleBottom();
  await page.getByText('Marketing', { exact: true }).click();
  await expect
    .poll(() => page.getByRole('button', { name: 'TikTok script', exact: true }).isVisible())
    .toBe(true);
  expect(await titleBottom()).toBe(initialBottom);
  await page.getByText('Marketing', { exact: true }).click();
  await page.getByRole('button', { name: /^Product listing/ }).click();
  await expect.poll(() => editor.value()).toBe('Travel bag listing');
  await expect
    .poll(() =>
      page.getByRole('complementary', { name: 'Review references', exact: true }).isVisible(),
    )
    .toBe(true);
  await page.getByText('[1] Product guide', { exact: true }).click();
  await expect
    .poll(() => page.getByText('Capacity is 20 litres.', { exact: true }).isVisible())
    .toBe(true);
  await expect.poll(() => page.getByText('20 L capacity', { exact: true }).isVisible()).toBe(true);
  await expect.poll(() => editor.inViewport()).toBe(true);

  const draftHeight = () =>
    page.evaluate(() => document.querySelector('main textarea')?.getBoundingClientRect().height);
  const initialHeight = await draftHeight();
  const longDraft = 'Capacity and materials\n'.repeat(45);
  await editor.fill(longDraft);
  await expect.poll(() => editor.value()).toBe(longDraft);
  expect(await draftHeight()).toBe(initialHeight);
  await expect.poll(() => page.getByText('20 L capacity', { exact: true }).inViewport()).toBe(true);
});
