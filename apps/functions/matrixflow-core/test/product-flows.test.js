import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runAgent,
  generateContent,
  generateAllContent,
  retrieveKnowledgeContext,
} from '../src/features.js';
import { schemas, parse } from '../src/schemas.js';

const context = { teamId: 'team-1', userId: 'user-1' };
test('inactive workers fail before reading or reserving AI quota', async () => {
  const calls = [];
  const services = {
    tables: {
      getRow: async ({ tableId }) => {
        calls.push(tableId);
        return { $id: 'agent-1', organizationId: 'team-1', status: 'PAUSED' };
      },
    },
  };
  await assert.rejects(runAgent(services, context, { agentId: 'agent-1' }), {
    code: 'AGENT_NOT_ACTIVE',
  });
  assert.deepEqual(calls, ['agents']);
});
test('unknown or foreign content projects cannot consume AI quota', async () => {
  const services = {
    tables: { getRow: async () => ({ $id: 'foreign', organizationId: 'team-2' }) },
  };
  for (const generate of [generateContent, generateAllContent]) {
    await assert.rejects(generate(services, context, { projectId: 'foreign' }), {
      code: 'FORBIDDEN',
    });
  }
});
test('knowledge retrieval uses current tenant-owned chunks and preserves citations without inference', async () => {
  const reads = [];
  const services = {
    tables: {
      getRow: async () => ({ $id: 'kb-1', organizationId: 'team-1' }),
      listRows: async ({ tableId, queries }) => {
        reads.push(queries);
        return {
          total: tableId === 'knowledge_documents' ? 1 : 2,
          rows:
            tableId === 'knowledge_documents'
              ? [{ $id: 'doc-1', title: 'Travel bag', indexVersion: 'current' }]
              : [
                  {
                    $id: 'old',
                    documentId: 'doc-1',
                    indexVersion: 'old',
                    content: 'Travel bag has fake old specs',
                  },
                  {
                    $id: 'current',
                    documentId: 'doc-1',
                    indexVersion: 'current',
                    content: 'Travel bag capacity is 20 liters',
                  },
                ],
        };
      },
    },
  };
  const result = await retrieveKnowledgeContext(services, context, {
    knowledgeBaseId: 'kb-1',
    question: 'bag capacity',
  });
  assert.match(result.contextText, /20 liters/);
  assert.doesNotMatch(result.contextText, /fake old/);
  assert.equal(result.citations[0].chunkId, 'current');
  assert.ok(reads.every((queries) => queries.some((query) => query.includes('organizationId'))));
});
test('knowledge links can be removed explicitly while invalid IDs fail validation', () => {
  assert.equal(parse(schemas.agentUpdate, { knowledgeBaseId: null }).knowledgeBaseId, null);
  assert.throws(() => parse(schemas.agentUpdate, { knowledgeBaseId: 'x'.repeat(37) }), {
    code: 'VALIDATION_ERROR',
  });
});
