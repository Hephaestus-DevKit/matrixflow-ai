import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { generateAllContent, generateContent } from '../src/features.js';
import { executeJob } from '../src/jobs.js';
import { handleContentRoute } from '../src/routes/content.js';

const context = { teamId: 'team', userId: 'user' };
const project = {
  $id: 'project',
  organizationId: 'team',
  status: 'ACTIVE',
  name: 'Travel bag',
  productData: '{}',
};
const quotaId = createHash('sha256')
  .update('team:resource:contentProjectLimit')
  .digest('hex')
  .slice(0, 32);

function contentStore({ counter = 1, beforeCommit, afterCommit, beforeDelete } = {}) {
  const rows = new Map();
  const versions = new Map();
  const transactions = new Map();
  const stagedItemIds = [];
  let transactionCount = 0;

  function store(key, value) {
    versions.set(key, (versions.get(key) ?? 0) + 1);
    if (value) rows.set(key, value);
    else rows.delete(key);
  }

  function update(key, value, transactionId) {
    if (transactionId) {
      const transaction = transactions.get(transactionId);
      transaction.operations.push({ key, value, version: versions.get(key) });
    } else store(key, value);
  }

  function read(key) {
    const row = rows.get(key);
    if (!row) throw Object.assign(new Error('Missing row'), { code: 404 });
    return row;
  }

  function select(tableId, queries = []) {
    const query = queries.map(JSON.parse);
    const limit = query.find(({ method }) => method === 'limit')?.values[0];
    return [...rows.entries()]
      .filter(([key]) => key.startsWith(`${tableId}/`))
      .map(([, row]) => row)
      .filter((row) =>
        query
          .filter(({ method }) => method === 'equal')
          .every(({ attribute, values }) => values.includes(row[attribute])),
      )
      .slice(0, limit);
  }

  store('content_projects/project', project);
  store('content_items/older', { $id: 'older', organizationId: 'team', projectId: 'project' });
  store('content_items/other', { $id: 'other', organizationId: 'team', projectId: 'other' });
  store('content_items/foreign', {
    $id: 'foreign',
    organizationId: 'foreign',
    projectId: 'project',
  });
  if (counter !== null) store(`usage_counters/${quotaId}`, { $id: quotaId, used: counter });

  const tables = {
    getRow: async ({ tableId, rowId }) => read(`${tableId}/${rowId}`),
    listRows: async ({ tableId, queries }) => {
      const selected = select(tableId, queries);
      return { rows: selected, total: selected.length };
    },
    createRow: async ({ tableId, rowId, data, transactionId }) => {
      const row = { $id: rowId, ...data };
      update(`${tableId}/${rowId}`, row, transactionId);
      if (tableId === 'content_items') stagedItemIds.push(rowId);
      return row;
    },
    updateRow: async ({ tableId, rowId, data, transactionId }) => {
      const key = `${tableId}/${rowId}`;
      const row = { ...read(key), ...data };
      update(key, row, transactionId);
      return row;
    },
    deleteRow: async ({ tableId, rowId, transactionId }) => {
      const key = `${tableId}/${rowId}`;
      read(key);
      update(key, undefined, transactionId);
    },
    deleteRows: async ({ tableId, queries }) => {
      await beforeDelete?.();
      const selected = select(tableId, queries);
      for (const row of selected) store(`${tableId}/${row.$id}`, undefined);
      return { rows: [], total: selected.length };
    },
    decrementRowColumn: async ({ tableId, rowId, transactionId }) => {
      const key = `${tableId}/${rowId}`;
      const row = read(key);
      assert.ok(row.used > 0);
      update(key, { ...row, used: row.used - 1 }, transactionId);
    },
    createTransaction: async () => {
      const id = String(++transactionCount);
      transactions.set(id, { status: 'pending', operations: [] });
      return { $id: id };
    },
    getTransaction: async ({ transactionId }) => transactions.get(transactionId),
    updateTransaction: async ({ transactionId, commit }) => {
      const transaction = transactions.get(transactionId);
      if (!transaction) throw Object.assign(new Error('Missing receipt'), { code: 404 });
      if (transaction.status === 'committed') return transaction;
      if (!commit) {
        transaction.status = 'rolled_back';
        return transaction;
      }
      const item = transaction.operations.find(({ key }) => key.startsWith('content_items/'));
      if (item) await beforeCommit?.();
      if (transaction.operations.some(({ key, version }) => versions.get(key) !== version)) {
        throw Object.assign(new Error('Concurrent write'), {
          code: 409,
          type: 'transaction_conflict',
        });
      }
      for (const { key, value } of transaction.operations) store(key, value);
      transaction.status = 'committed';
      if (item) await afterCommit?.(() => transactions.delete(transactionId));
      return transaction;
    },
  };
  return { tables, rows, stagedItemIds };
}

function mockProvider(t, beforeResponse = async () => {}, responseText = () => 'Confirmed draft') {
  const previousProvider = process.env.MATRIXFLOW_AI_PROVIDER;
  const previousKey = process.env.DEEPSEEK_API_KEY;
  process.env.MATRIXFLOW_AI_PROVIDER = 'deepseek';
  process.env.DEEPSEEK_API_KEY = 'test-only-provider-key';
  t.after(() => {
    if (previousProvider === undefined) delete process.env.MATRIXFLOW_AI_PROVIDER;
    else process.env.MATRIXFLOW_AI_PROVIDER = previousProvider;
    if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousKey;
  });
  let calls = 0;
  return t.mock.method(globalThis, 'fetch', async () => {
    await beforeResponse(++calls);
    return Response.json({
      content: [{ type: 'text', text: responseText(calls) }],
      usage: { input_tokens: 5, output_tokens: 2 },
    });
  });
}

function deleteProject(services) {
  return handleContentRoute({
    services,
    context,
    membership: { roles: ['owner'] },
    segments: ['content', 'projects', 'project'],
    method: 'DELETE',
  });
}

test('deletion between a generation write and its commit prevents an orphan item', async (t) => {
  const provider = mockProvider(t);
  let services;
  services = contentStore({
    beforeCommit: async () => assert.deepEqual(await deleteProject(services), { deleted: true }),
  });

  await assert.rejects(generateContent(services, context, { projectId: 'project' }), {
    code: 'CONTENT_PROJECT_DELETING',
  });
  assert.equal(provider.mock.callCount(), 1);
  assert.equal(services.rows.has('content_projects/project'), false);
  assert.deepEqual(
    [...services.rows.keys()].filter((key) => key.startsWith('content_items/')),
    ['content_items/other', 'content_items/foreign'],
  );
  assert.equal(services.rows.get(`usage_counters/${quotaId}`).used, 0);
  const audits = [...services.rows.values()].filter((row) => row.action);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, 'content_project.deleted');
  assert.deepEqual(JSON.parse(audits[0].metadata), { deletedItems: 1 });
});

for (const counter of [0, null]) {
  test(`interrupted deletion resumes with legacy quota counter ${counter}`, async () => {
    let interrupt = true;
    const services = contentStore({
      counter,
      beforeDelete: () => {
        if (interrupt) throw new Error('Temporary storage outage');
      },
    });
    await assert.rejects(deleteProject(services), /Temporary storage outage/);
    assert.equal(services.rows.get('content_projects/project').status, 'DELETING');
    await assert.rejects(generateContent(services, context, { projectId: 'project' }), {
      code: 'CONTENT_PROJECT_DELETING',
    });
    interrupt = false;
    assert.deepEqual(await deleteProject(services), { deleted: true });
    assert.equal(services.rows.has('content_projects/project'), false);
    assert.equal(services.rows.has('content_items/older'), false);
  });
}

test('a conflict retries persistence only and a lost commit receipt recovers the same item', async (t) => {
  const provider = mockProvider(t);
  let attempts = 0;
  const services = contentStore({
    beforeCommit: () => {
      if (++attempts === 1)
        throw Object.assign(new Error('Concurrent write'), { type: 'transaction_conflict' });
    },
    afterCommit: (loseReceipt) => {
      loseReceipt();
      throw new Error('Commit response lost');
    },
  });
  const result = await generateContent(services, context, { projectId: 'project' });
  assert.equal(provider.mock.callCount(), 1);
  assert.equal(result.content, 'Confirmed draft');
  assert.deepEqual(services.stagedItemIds, [result.itemId, result.itemId]);
  assert.equal(services.rows.get(`content_items/${result.itemId}`).status, 'READY');
  const audits = [...services.rows.values()].filter((row) => row.action === 'content.generated');
  assert.equal(audits.length, 1);
  assert.equal(audits[0].resourceId, result.itemId);
});

test('the first format becomes ready while other batch provider responses are pending', async (t) => {
  const slowFormats = Promise.withResolvers();
  const firstCommit = Promise.withResolvers();
  t.after(() => slowFormats.resolve());
  const provider = mockProvider(t, async (call) => {
    if (call === 2 || call === 3) await slowFormats.promise;
  });
  const services = contentStore({ afterCommit: () => firstCommit.resolve() });
  const pending = generateAllContent(services, context, { projectId: 'project' });
  try {
    await Promise.race([firstCommit.promise, pending]);
    assert.equal(provider.mock.callCount(), 3);
    assert.equal(services.stagedItemIds.length, 1);
    assert.equal(services.rows.get(`content_items/${services.stagedItemIds[0]}`).status, 'READY');
  } finally {
    slowFormats.resolve();
  }
  const result = await pending;
  assert.equal(result.completed, 12);
  assert.equal(result.failed, 0);
  assert.equal(provider.mock.callCount(), 12);
});

const deliveryRoute = (services, path, method, body = {}, ctx = context) =>
  handleContentRoute({
    services,
    context: ctx,
    membership: { roles: ['member'] },
    segments: path.split('/'),
    method,
    body,
  });
const headers = [
  'Type',
  'Identification',
  'Field',
  'Locale',
  'Market',
  'Status',
  'Default content',
  'Translated content',
  'Custom header',
];
const csvRow = (id, source, existing = '') => [
  'PRODUCT',
  id,
  'body_html',
  'de',
  '',
  'outdated',
  source,
  existing,
  'keep, exactly',
];

test('team draft saves preserve the original, reject stale revisions and foreign items', async () => {
  const services = contentStore();
  const path = 'content/items/older/review';
  const save = await deliveryRoute(services, path, 'PUT', {
    revision: 0,
    text: 'Draft',
    reviewed: false,
  });
  assert.equal(save.author, 'user');
  await assert.rejects(deliveryRoute(services, 'content/items/older/delivery', 'GET'), {
    code: 'REVIEW_CONFLICT',
  });
  await assert.rejects(
    deliveryRoute(services, path, 'PUT', { revision: 0, text: 'Lost update', reviewed: true }),
    { code: 'REVIEW_CONFLICT' },
  );
  const reviewed = await deliveryRoute(
    services,
    path,
    'PUT',
    { revision: 1, text: 'Final', reviewed: true },
    { ...context, userId: 'colleague' },
  );
  assert.equal(reviewed.author, 'colleague');
  assert.equal(
    (await deliveryRoute(services, 'content/items/older/delivery', 'GET')).review.text,
    'Final',
  );
  await assert.rejects(
    deliveryRoute(services, 'content/items/foreign/review', 'PUT', {
      revision: 0,
      text: 'invalid',
      reviewed: true,
    }),
    { code: 'FORBIDDEN' },
  );
});

test('Shopify CSV round trip preserves identity, markup and extra columns; reimport invalidates changed content only', async () => {
  const services = contentStore();
  const upload = (rows) =>
    deliveryRoute(services, 'content/projects/project/translations', 'POST', {
      filename: 'translations.csv',
      headers,
      rows,
    });
  const rows = [csvRow('000123', '<p>23 L</p>'), csvRow('000124', 'Blue & white')];
  const imported = await upload(rows);
  const keys = services.stagedItemIds.slice();
  assert.equal(keys.length, 2);
  await assert.rejects(upload([rows[0], rows[0]]), { code: 'INVALID_REQUEST' });
  const save = (id, text, revision = 1) =>
    deliveryRoute(services, 'content/items/' + id + '/review', 'PUT', {
      revision,
      text,
      reviewed: true,
    });
  await assert.rejects(save(keys[0], '<p>32 L</p>'), { code: 'TRANSLATION_STRUCTURE_CHANGED' });
  await assert.rejects(save(keys[0], '<img>23 L'), { code: 'TRANSLATION_STRUCTURE_CHANGED' });
  await save(keys[0], '<p>23 Liter</p>');
  assert.deepEqual(await upload(rows), imported);
  const file = await deliveryRoute(
    services,
    'content/projects/project/translations/' + imported.batch,
    'GET',
  );
  assert.deepEqual(file.headers, headers);
  assert.deepEqual(file.rows, [csvRow('000123', '<p>23 L</p>', '<p>23 Liter</p>')]);
  assert.equal(file.reviews[0].author, context.userId);
  await save(keys[1], 'Blau und weiß');
  const next = await upload([csvRow('000123', '<p>24 L</p>'), rows[1]]);
  assert.notEqual(next.batch, imported.batch);
  const changed = JSON.parse(services.rows.get('content_items/' + keys[0]).body);
  assert.equal(changed.review.reviewed, false);
  assert.equal(
    (await deliveryRoute(services, 'content/projects/project/translations/' + next.batch, 'GET'))
      .rows.length,
    1,
  );
});

test('an updated manual blocks delivery of a previously approved draft', async () => {
  const services = contentStore();
  const item = services.rows.get('content_items/older');
  item.metadata = JSON.stringify({
    citations: [{ docId: 'doc', indexVersion: 'v1', title: 'Manual' }],
  });
  const doc = { $id: 'doc', organizationId: 'team', status: 'READY', indexVersion: 'v1' };
  services.rows.set('knowledge_documents/doc', doc);
  await deliveryRoute(services, 'content/items/older/review', 'PUT', {
    revision: 0,
    text: 'approved',
    reviewed: true,
  });
  doc.indexVersion = 'v2';
  await assert.rejects(deliveryRoute(services, 'content/items/older/delivery', 'GET'), {
    code: 'REVIEW_SOURCE_CHANGED',
  });
});

test('two reviewers cannot commit the same revision and recover the saved version after a lost receipt', async () => {
  let competitor;
  const services = contentStore({
    beforeCommit: async () => {
      if (competitor) {
        const run = competitor;
        competitor = null;
        await run();
      }
    },
    afterCommit: (lose) => {
      lose();
      throw new Error('lost receipt');
    },
  });
  const put = (text) =>
    deliveryRoute(services, 'content/items/older/review', 'PUT', {
      text,
      revision: 0,
      reviewed: true,
    });
  competitor = () => put('colleague');
  await assert.rejects(put('old edit'), { code: 'REVIEW_CONFLICT' });
  assert.equal(
    (await deliveryRoute(services, 'content/items/older/delivery', 'GET')).review.text,
    'colleague',
  );
});

test('failed translation imports leave no partial rows or audit; the same file can be retried', async () => {
  const services = contentStore();
  const rows = [csvRow('031', 'A'), csvRow('032', 'B')];
  const path = 'content/projects/project/translations';
  const original = services.tables.createRow;
  services.tables.createRow = (args) => {
    if (args.data.type === 'shopify_translation' && services.stagedItemIds.length)
      throw new Error('interrupted');
    return original(args);
  };
  await assert.rejects(
    deliveryRoute(services, path, 'POST', { filename: 'test.csv', headers, rows }),
    /interrupted/,
  );
  assert.ok(![...services.rows.values()].some((row) => row.type === 'shopify_translation'));
  services.tables.createRow = original;
  assert.equal(
    (await deliveryRoute(services, path, 'POST', { filename: 'test.csv', headers, rows })).rows,
    2,
  );
});

test('a slow translation cannot overwrite a human edit made while the model was running', async (t) => {
  const services = contentStore();
  await deliveryRoute(services, 'content/projects/project/translations', 'POST', {
    filename: 'fields.csv',
    headers,
    rows: [csvRow('01', 'Travel bag')],
  });
  const path = 'content/items/' + services.stagedItemIds[0];
  const provider = mockProvider(t, () =>
    deliveryRoute(services, path + '/review', 'PUT', {
      revision: 1,
      text: 'Team decision',
      reviewed: true,
    }),
  );
  await assert.rejects(deliveryRoute(services, path + '/translate', 'POST', { revision: 1 }), {
    code: 'REVIEW_CONFLICT',
  });
  assert.equal(provider.mock.callCount(), 1);
  assert.equal(
    (await deliveryRoute(services, path + '/delivery', 'GET')).review.text,
    'Team decision',
  );
});

test('editing facts rejects stale writers and requires regenerating old approved copy', async (t) => {
  const services = contentStore();
  const facts = 'content/projects/project/facts';
  const approval = 'content/items/older/review';
  await deliveryRoute(services, approval, 'PUT', { revision: 0, text: 'Old', reviewed: true });
  const saved = await deliveryRoute(services, facts, 'PUT', { revision: 0, description: '24 L' });
  assert.deepEqual(saved.productData, { factsRevision: 1, description: '24 L' });
  await assert.rejects(
    deliveryRoute(services, facts, 'PUT', {
      revision: 0,
      description: '23 L',
    }),
    { code: 'CONTENT_FACTS_CHANGED' },
  );
  await assert.rejects(deliveryRoute(services, 'content/items/older/delivery', 'GET'), {
    code: 'CONTENT_FACTS_CHANGED',
  });
  await assert.rejects(
    deliveryRoute(services, approval, 'PUT', {
      revision: 1,
      text: 'Old',
      reviewed: true,
    }),
    { code: 'CONTENT_FACTS_CHANGED' },
  );
  mockProvider(t);
  const fresh = await generateContent(services, context, { projectId: 'project', type: 'listing' });
  await deliveryRoute(services, 'content/items/' + fresh.itemId + '/review', 'PUT', {
    revision: 0,
    text: fresh.content,
    reviewed: true,
  });
  assert.equal(
    (await deliveryRoute(services, 'content/items/' + fresh.itemId + '/delivery', 'GET')).review
      .text,
    fresh.content,
  );
});

test('Shopify translation checkpoints each field and skips concurrent team edits', async (t) => {
  const services = contentStore();
  const dispatched = [];
  services.functions = { createExecution: async (execution) => dispatched.push(execution) };
  const previousSecret = process.env.MATRIXFLOW_WORKER_SECRET;
  const previousRetries = process.env.MATRIXFLOW_AI_MAX_RETRIES;
  process.env.MATRIXFLOW_WORKER_SECRET = 'test-secret-for-translation-batch-012345';
  process.env.MATRIXFLOW_AI_MAX_RETRIES = '0';
  t.after(() => {
    if (previousSecret === undefined) delete process.env.MATRIXFLOW_WORKER_SECRET;
    else process.env.MATRIXFLOW_WORKER_SECRET = previousSecret;
    if (previousRetries === undefined) delete process.env.MATRIXFLOW_AI_MAX_RETRIES;
    else process.env.MATRIXFLOW_AI_MAX_RETRIES = previousRetries;
  });
  const provider = mockProvider(t, (call) => {
    if (call === 1) throw new TypeError('Temporary connection failure');
  });
  const route = 'content/projects/project/translations';
  const { batch } = await deliveryRoute(services, route, 'POST', {
    filename: 'catalog.csv',
    headers,
    rows: [csvRow('01', 'Travel bag'), csvRow('02', 'Hat')],
  });
  const [first, second] = services.stagedItemIds;
  const items = [first, second].map((id) => ({ id, revision: 1 }));
  await assert.rejects(deliveryRoute(services, route + '/wrong-batch', 'POST', { items }), {
    code: 'INVALID_REQUEST',
  });
  const job = await deliveryRoute(services, route + '/' + batch, 'POST', { items });
  assert.equal(job.status, 202);
  const jobId = job.data.id;
  const run = () => executeJob(services, { jobId, organizationId: context.teamId });
  assert.equal(dispatched.length, 1);
  const retry = await run();
  assert.equal(retry.status, 'RETRY_WAIT');
  assert.deepEqual(retry.progress, { processed: 0, total: 2 });
  assert.equal((await run()).status, 'RETRY_WAIT');
  assert.equal(provider.mock.callCount(), 1);
  t.mock.method(Date, 'now', () => Date.parse(retry.runAfter) + 1);
  const checkpoint = await run();
  assert.equal(checkpoint.status, 'QUEUED');
  assert.deepEqual(checkpoint.progress, { processed: 1, total: 2 });
  assert.equal(dispatched.length, 3);
  await deliveryRoute(services, 'content/items/' + second + '/review', 'PUT', {
    revision: 1,
    text: 'Manually translated',
    reviewed: true,
  });
  const completed = await run();
  assert.equal(completed.status, 'SUCCEEDED');
  assert.deepEqual(completed.result, {
    cursor: 2,
    completed: 1,
    skipped: 1,
    failed: 0,
    errors: [],
  });
  assert.match(completed.resourceHref, /view=translations&translationJob=/);
  assert.equal(provider.mock.callCount(), 2);
  assert.equal((await run()).status, 'SUCCEEDED');
  assert.equal(provider.mock.callCount(), 2);
});

test('published product specifications survive translation and Shopify CSV delivery', async (t) => {
  // Public specs for the 13-inch model: https://www.apple.com/macbook-air/specs/
  const source = '<p>MacBook Air with M5. 13.6-inch display, 2560 by 1664 pixels, 1.23 kg.</p>';
  const translation = '<p>MacBook Air mit M5. 13,6-Zoll-Display, 2560 × 1664 Pixel, 1,23 kg.</p>';
  mockProvider(t, undefined, (call) =>
    call === 1 ? translation.replace('1,23', '1,32') : translation,
  );
  const services = contentStore();
  const route = 'content/projects/project/translations';
  const row = csvRow('000492', source);
  const { batch } = await deliveryRoute(services, route, 'POST', {
    filename: 'macbook-air.csv',
    headers,
    rows: [row],
  });
  const [id] = services.stagedItemIds;
  const item = 'content/items/' + id;
  await assert.rejects(deliveryRoute(services, item + '/translate', 'POST', { revision: 1 }), {
    code: 'TRANSLATION_STRUCTURE_CHANGED',
  });
  const draft = await deliveryRoute(services, item + '/translate', 'POST', { revision: 1 });
  assert.equal(draft.text, translation);
  await deliveryRoute(services, item + '/review', 'PUT', {
    revision: draft.revision,
    text: draft.text,
    reviewed: true,
  });
  const exported = await deliveryRoute(services, route + '/' + batch, 'GET');
  assert.deepEqual(exported.rows, [csvRow('000492', source, translation)]);
});
