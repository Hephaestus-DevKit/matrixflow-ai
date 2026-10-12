import test from 'node:test';
import assert from 'node:assert/strict';
import { handleContentRoute } from '../src/routes/content.js';

for (const suffix of ['generate', 'generate-all']) {
  test(`content ${suffix} parses async input and enqueues the requested parameters`, async () => {
    const previous = process.env.MATRIXFLOW_WORKER_SECRET;
    process.env.MATRIXFLOW_WORKER_SECRET = 'worker-test-'.repeat(4);
    const rows = [];
    const services = {
      tables: {
        getRow: async () => ({ $id: 'project-1', organizationId: 'team-1' }),
        createRow: async ({ rowId, data }) => {
          rows.push(data);
          return { $id: rowId, ...data };
        },
      },
      functions: { createExecution: async () => ({ $id: 'execution' }) },
    };
    try {
      const result = await handleContentRoute({
        services,
        context: { teamId: 'team-1', userId: 'user-1' },
        membership: { roles: ['owner'] },
        segments: ['content', 'projects', 'project-1', suffix],
        method: 'POST',
        body: {
          type: 'product_title',
          language: 'de',
          variables: { targetMarket: 'Germany' },
          mode: 'async',
        },
      });
      assert.equal(result.status, 202);
      assert.equal(result.data.status, 'QUEUED');
      assert.equal(rows[0].type, `content.${suffix === 'generate' ? 'generate' : 'generate-all'}`);
      assert.deepEqual(JSON.parse(rows[0].payload), {
        projectId: 'project-1',
        type: 'product_title',
        language: 'de',
        variables: { targetMarket: 'Germany' },
      });
    } finally {
      if (previous === undefined) delete process.env.MATRIXFLOW_WORKER_SECRET;
      else process.env.MATRIXFLOW_WORKER_SECRET = previous;
    }
  });
}
