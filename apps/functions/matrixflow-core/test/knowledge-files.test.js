import test from 'node:test';
import assert from 'node:assert/strict';
import { Permission, Role } from 'node-appwrite';
import { validateKnowledgeFile } from '../src/knowledge-files.js';
import { indexDocument } from '../src/features.js';
import { handleKnowledgeRoute } from '../src/routes/knowledge.js';

function servicesFor(file) {
  return { storage: { getFile: async () => file } };
}

test('knowledge documents use authoritative Storage metadata scoped to the current team', async () => {
  const result = await validateKnowledgeFile(
    servicesFor({
      $id: 'file-1',
      name: 'manual.pdf',
      mimeType: 'application/pdf',
      sizeOriginal: 2048,
      $permissions: [Permission.read(Role.team('team-1'))],
    }),
    'team-1',
    { fileId: 'file-1', title: 'Product manual', mimeType: 'text/plain', size: 1 },
  );
  assert.deepEqual(result, {
    fileId: 'file-1',
    title: 'Product manual',
    mimeType: 'application/pdf',
    size: 2048,
  });
});

test('knowledge documents reject cross-team or broadly readable uploads', async () => {
  await assert.rejects(
    () =>
      validateKnowledgeFile(
        servicesFor({
          $id: 'file-1',
          mimeType: 'application/pdf',
          sizeOriginal: 2048,
          $permissions: [Permission.read(Role.team('team-2'))],
        }),
        'team-1',
        { fileId: 'file-1', title: 'Manual', mimeType: 'application/pdf', size: 2048 },
      ),
    (error) => error.code === 'FILE_FORBIDDEN',
  );
  await assert.rejects(
    () =>
      validateKnowledgeFile(
        servicesFor({
          $id: 'file-1',
          mimeType: 'application/pdf',
          sizeOriginal: 2048,
          $permissions: [Permission.read(Role.team('team-1')), Permission.read(Role.any())],
        }),
        'team-1',
        { fileId: 'file-1', title: 'Manual', mimeType: 'application/pdf', size: 2048 },
      ),
    (error) => error.code === 'FILE_FORBIDDEN',
  );
});

function knowledgeIndexFixture({ status = 'READY', text = 'Updated warranty policy.' } = {}) {
  const fixture = {
    document: {
      $id: 'document-1',
      organizationId: 'team-1',
      knowledgeBaseId: 'kb-1',
      fileId: 'file-1',
      status,
      indexVersion: status === 'READY' ? 'previous' : null,
    },
    chunks: new Map(),
    audit: [],
    beforeCommit: null,
    loseCommitResponse: false,
    discardCommitReceipt: false,
    failChunkDeletion: false,
  };
  if (fixture.document.indexVersion)
    fixture.chunks.set('previous', {
      $id: 'previous',
      organizationId: 'team-1',
      documentId: fixture.document.$id,
      indexVersion: 'previous',
      content: 'Previous warranty policy.',
    });
  const transactions = new Map();
  fixture.services = {
    storage: {
      getFile: async () => ({
        $id: 'file-1',
        name: 'manual.txt',
        mimeType: 'text/plain',
        sizeOriginal: 2048,
        $permissions: [Permission.read(Role.team('team-1'))],
      }),
      getFileDownload: async () => Buffer.from(text),
      deleteFile: async () => true,
    },
    tables: {
      getRow: async ({ tableId, rowId }) => {
        const row =
          tableId === 'knowledge_documents' ? fixture.document : fixture.chunks.get(rowId);
        if (!row) throw { code: 404 };
        return { ...row };
      },
      listRows: async ({ tableId }) => {
        const rows =
          tableId === 'knowledge_documents'
            ? [fixture.document].filter(Boolean)
            : [...fixture.chunks.values()];
        return { total: rows.length, rows };
      },
      createRow: async ({ rowId, data, transactionId }) => {
        const row = { $id: rowId, ...data };
        if (transactionId) transactions.get(transactionId).audit = row;
        else fixture.audit.push(row);
        return row;
      },
      createRows: async ({ rows, transactionId }) => {
        transactions.get(transactionId).chunks.push(...rows);
        return { total: rows.length, rows: [] };
      },
      deleteRow: async ({ tableId, rowId }) => {
        if (tableId === 'knowledge_documents') fixture.document = null;
        else {
          if (fixture.failChunkDeletion) throw new Error('Temporary chunk deletion failure');
          fixture.chunks.delete(rowId);
        }
      },
      createTransaction: async () => {
        const $id = `transaction-${transactions.size}`;
        transactions.set($id, { $id, status: 'pending', chunks: [] });
        return { $id };
      },
      getTransaction: async ({ transactionId }) =>
        transactions.get(transactionId) || Promise.reject({ code: 404 }),
      updateRow: async ({ data, transactionId }) => {
        const transaction = transactions.get(transactionId);
        transaction.snapshot = fixture.document;
        transaction.document = { ...fixture.document, ...data };
        return transaction.document;
      },
      updateTransaction: async ({ transactionId, commit, rollback }) => {
        const transaction = transactions.get(transactionId);
        if (rollback) transaction.status = 'rolled_back';
        if (commit) {
          const beforeCommit = fixture.beforeCommit;
          fixture.beforeCommit = null;
          await beforeCommit?.();
          if (transaction.snapshot !== fixture.document) {
            transaction.status = 'failed';
            throw { type: 'transaction_conflict', code: 409 };
          }
          fixture.document = transaction.document;
          for (const chunk of transaction.chunks) fixture.chunks.set(chunk.$id, chunk);
          if (transaction.audit) fixture.audit.push(transaction.audit);
          transaction.status = 'committed';
          if (fixture.discardCommitReceipt) transactions.delete(transactionId);
          if (fixture.loseCommitResponse) throw new Error('Connection reset after commit');
        }
        return transaction;
      },
    },
  };
  fixture.index = () =>
    indexDocument(
      fixture.services,
      { teamId: 'team-1', userId: 'user-1' },
      {
        documentId: 'document-1',
      },
    );
  fixture.delete = () =>
    handleKnowledgeRoute({
      services: fixture.services,
      context: { teamId: 'team-1', userId: 'user-1' },
      membership: { roles: ['owner'] },
      segments: ['kb', 'kb-1', 'documents', 'document-1'],
      method: 'DELETE',
    });
  return fixture;
}

test('only the winning concurrent rebuild publishes chunks and an audit row', async () => {
  const fixture = knowledgeIndexFixture();
  let winningIndex;
  fixture.beforeCommit = async () => {
    winningIndex = await fixture.index();
  };
  await assert.rejects(fixture.index(), { code: 'KNOWLEDGE_INDEX_CHANGED' });
  assert.equal(fixture.document.status, 'READY');
  assert.equal(fixture.document.indexVersion, winningIndex.indexVersion);
  assert.deepEqual(
    [...fixture.chunks.values()].map((chunk) => chunk.indexVersion),
    [winningIndex.indexVersion],
  );
  assert.equal(fixture.audit.length, 1);
});

test('failed rebuild keeps the previously searchable index, while an initial failure is recorded', async () => {
  for (const status of ['READY', 'UPLOADED']) {
    const fixture = knowledgeIndexFixture({ status, text: '' });
    await assert.rejects(fixture.index(), { code: 'EMPTY_DOCUMENT' });
    assert.equal(fixture.document.status, status === 'READY' ? 'READY' : 'ERROR');
    assert.equal(fixture.chunks.size, status === 'READY' ? 1 : 0);
    assert.equal(fixture.audit.length, 0);
  }
});

test('a lost commit response keeps the published chunks and the audit row', async () => {
  const fixture = knowledgeIndexFixture();
  fixture.loseCommitResponse = true;
  const result = await fixture.index();
  assert.equal(result.indexVersion, fixture.document.indexVersion);
  assert.deepEqual(
    [...fixture.chunks.values()].map((chunk) => chunk.indexVersion),
    [result.indexVersion],
  );
  assert.equal(fixture.audit.length, 1);
});

test('a published index proves success if Appwrite discarded its transaction receipt', async () => {
  const fixture = knowledgeIndexFixture();
  fixture.loseCommitResponse = true;
  fixture.discardCommitReceipt = true;
  const result = await fixture.index();
  assert.equal(result.indexVersion, fixture.document.indexVersion);
  assert.deepEqual(
    [...fixture.chunks.values()].map((chunk) => chunk.indexVersion),
    [result.indexVersion],
  );
});

test('deleting a document prevents a concurrent rebuild from leaving orphan chunks', async () => {
  const fixture = knowledgeIndexFixture();
  fixture.beforeCommit = async () => {
    assert.equal((await fixture.delete()).deleted, true);
  };
  await assert.rejects(fixture.index(), { code: 'KNOWLEDGE_INDEX_CHANGED' });
  assert.equal(fixture.document, null);
  assert.equal(fixture.chunks.size, 0);
  assert.deepEqual(
    fixture.audit.map(({ action }) => action),
    ['knowledge_document.deleted'],
  );
});

test('a failed chunk deletion keeps the document fenced and can be retried', async () => {
  const fixture = knowledgeIndexFixture();
  fixture.failChunkDeletion = true;
  await assert.rejects(fixture.delete(), /Temporary chunk deletion failure/);
  assert.equal(fixture.document.status, 'DELETING');
  await assert.rejects(fixture.index(), { code: 'KNOWLEDGE_INDEX_CHANGED' });
  fixture.failChunkDeletion = false;
  assert.equal((await fixture.delete()).deleted, true);
  assert.equal(fixture.document, null);
  assert.equal(fixture.chunks.size, 0);
});
