import { type Page } from '@playwright/test';

export async function mockWorkspace(
  page: Page,
  options: {
    slowIdentity?: boolean;
    identityUnavailable?: boolean;
    keepJobsRunning?: boolean;
  } = {},
) {
  const calls: Array<{ path: string; method: string; body: Record<string, unknown> }> = [];
  let items = [
    {
      $id: 'new-title',
      type: 'product_title',
      body: JSON.stringify({ raw: 'Newest saved title' }),
    },
    { $id: 'old-title', type: 'product_title', body: JSON.stringify({ raw: 'Older saved title' }) },
  ];
  let agent = {
    $id: 'agent-1',
    name: 'Support worker',
    role: 'Customer support',
    status: 'ACTIVE',
    model: 'deepseek-flash',
    systemPrompt: JSON.stringify({ raw: 'Use confirmed product facts.' }),
    configuration: JSON.stringify({}),
    skills: '[]',
  };
  let jobReads = 0;
  let canceled = false;
  let jobType = 'agent.run';
  const row = (value: Record<string, unknown>, org = 'team-1') => ({
    $createdAt: '2026-10-10T01:00:00Z',
    $updatedAt: '2026-10-10T01:00:00Z',
    organizationId: org,
    ...value,
  });
  await page
    .context()
    .addCookies([{ name: 'matrixflow-locale', value: 'en', domain: '127.0.0.1', path: '/' }]);
  await page.route('https://sgp.cloud.appwrite.io/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace('/v1', '');
    const respond = (json: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(json) });
    if (path === '/account') {
      if (options.slowIdentity) await new Promise((resolve) => setTimeout(resolve, 3_000));
      if (options.identityUnavailable)
        return respond({ code: 503, type: 'general_unknown', message: 'offline' }, 503);
      return respond({
        $id: 'user-1',
        email: 'test@example.invalid',
        name: 'Test operator',
        emailVerification: true,
        prefs: {},
        mfa: false,
      });
    }
    if (path === '/teams')
      return respond({
        total: 2,
        teams: [
          { $id: 'team-1', name: 'Team One' },
          { $id: 'team-2', name: 'Team Two' },
        ],
      });
    if (/\/teams\/[^/]+\/memberships$/.test(path))
      return respond({
        total: 1,
        memberships: [
          {
            $id: 'membership-1',
            userId: 'user-1',
            teamId: path.split('/')[2],
            confirm: true,
            roles: ['owner'],
          },
        ],
      });
    if (path.startsWith('/tablesdb/')) {
      const table = path.split('/')[4];
      const id = path.split('/')[6];
      const teamTwo = url.search.includes('team-2');
      if (id) {
        if (table === 'agents') return respond(row(agent));
        if (table === 'knowledge_bases')
          return respond(
            row({ $id: 'kb-1', name: 'Product handbook', description: 'Confirmed specifications' }),
          );
        if (table === 'workflows')
          return respond(
            row({
              $id: 'workflow-1',
              name: 'Product brief',
              currentVersion: 1,
              dsl: JSON.stringify({
                nodes: [
                  {
                    id: 'transform-1',
                    type: 'transform',
                    config: { template: '{{input.product}}' },
                    position: { x: 120, y: 100 },
                  },
                ],
                edges: [],
              }),
            }),
          );
      }
      let rows: Record<string, unknown>[] = [];
      if (!teamTwo) {
        if (table === 'content_projects')
          rows = [
            {
              $id: 'project-1',
              name: 'Travel bag',
              productData: JSON.stringify({ title: 'Travel bag', description: '20 L capacity' }),
            },
          ];
        if (table === 'content_items') rows = items;
        if (table === 'agents') rows = [agent];
        if (table === 'knowledge_bases') rows = [{ $id: 'kb-1', name: 'Product handbook' }];
        if (table === 'knowledge_documents')
          rows = [
            {
              $id: 'doc-1',
              knowledgeBaseId: 'kb-1',
              title: 'Bag specifications.txt',
              status: 'READY',
              chunkCount: 1,
            },
          ];
        if (table === 'workflow_versions')
          rows = [
            {
              $id: 'version-1',
              workflowId: 'workflow-1',
              version: 1,
              dsl: JSON.stringify({
                nodes: [
                  {
                    id: 'transform-1',
                    type: 'transform',
                    config: { template: '{{input.product}}' },
                    position: { x: 120, y: 100 },
                  },
                ],
                edges: [],
              }),
            },
          ];
      }
      return respond({ total: rows.length, rows: rows.map((value) => row(value)) });
    }
    if (path === '/functions/matrixflow-core/executions') {
      const request = req.postDataJSON() as { path: string; method: string; body: string };
      const body = JSON.parse(request.body);
      calls.push({ path: request.path, method: request.method, body });
      let data: unknown = {};
      if (request.path === '/health')
        data = { ai: { ready: true, model: 'deepseek-flash' }, limits: { monthlyAiCalls: 500 } };
      if (request.path === '/billing/usage') data = { ai_call: 7 };
      if (request.path === '/agents/agent-1' && request.method === 'PATCH') {
        agent = {
          ...agent,
          ...body,
          systemPrompt: JSON.stringify(body.systemPrompt ?? JSON.parse(agent.systemPrompt)),
          configuration: JSON.stringify({ knowledgeBaseId: body.knowledgeBaseId }),
        };
        data = row(agent);
      }
      if (
        request.path === '/kb/kb-1/ask' ||
        request.path === '/agents/agent-1/run' ||
        request.path === '/content/projects/project-1/generate-all' ||
        request.path === '/content/projects/project-1/generate' ||
        request.path === '/workflows/workflow-1/run'
      ) {
        jobType = request.path.includes('content')
          ? request.path.endsWith('/generate-all')
            ? 'content.generate-all'
            : 'content.generate'
          : request.path.includes('workflows')
            ? 'workflow.run'
            : request.path.includes('/kb/')
              ? 'knowledge.ask'
              : 'agent.run';
        jobReads = 0;
        data = { id: 'job-1', type: jobType, status: 'QUEUED', attempts: 0, maxAttempts: 3 };
      }
      if (request.path === '/jobs/job-1/cancel') {
        canceled = true;
        data = { id: 'job-1', type: jobType, status: 'CANCELED', attempts: 1, maxAttempts: 3 };
      }
      if (request.path === '/jobs/job-1') {
        jobReads++;
        data = {
          id: 'job-1',
          type: jobType,
          status: canceled
            ? 'CANCELED'
            : options.keepJobsRunning
              ? 'RUNNING'
              : jobReads > 1
                ? 'SUCCEEDED'
                : 'RUNNING',
          attempts: 1,
          maxAttempts: 3,
          result:
            jobType === 'agent.run'
              ? {
                  output: {
                    text: 'Grounded answer: capacity is 20 liters [资料 1].',
                    citations: [
                      {
                        chunkId: 'chunk-1',
                        docId: 'doc-1',
                        title: 'Bag specifications',
                        snippet: 'Capacity: 20 liters',
                      },
                    ],
                  },
                }
              : jobType === 'workflow.run'
                ? {
                    output: {
                      input: { product: 'Travel bag' },
                      nodes: { 'transform-1': 'Travel bag' },
                    },
                  }
                : jobType === 'content.generate'
                  ? { content: 'Generated German title' }
                  : jobType === 'knowledge.ask'
                    ? {
                        answer: 'Capacity is 20 liters.',
                        citations: [
                          {
                            chunkId: 'chunk-1',
                            docId: 'doc-1',
                            title: 'Bag specifications',
                            snippet: 'Capacity: 20 liters',
                          },
                        ],
                      }
                    : {
                        completed: 11,
                        failed: 1,
                        results: [
                          {
                            type: 'listing',
                            status: 'fulfilled',
                            value: { content: 'Generated listing' },
                          },
                        ],
                      },
        };
      }
      if (request.path.endsWith('/generate')) {
        items = [
          {
            $id: 'fresh-title',
            type: 'product_title',
            body: JSON.stringify({ raw: 'Generated German title' }),
          },
          ...items,
        ];
        data = {
          id: 'job-1',
          type: 'content.generate',
          status: 'QUEUED',
          attempts: 0,
          maxAttempts: 3,
        };
      }
      return respond({
        $id: 'execution-1',
        status: 'completed',
        responseStatusCode: 200,
        responseBody: JSON.stringify({ data }),
      });
    }
    return respond({ code: 404, message: `Unmocked route ${path}`, type: 'not_found' }, 404);
  });
  return { calls };
}
