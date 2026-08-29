import { expect, test, type Page, type Route } from '@playwright/test';

const APPWRITE_ORIGIN = 'https://sgp.cloud.appwrite.io';
const TEAM_ID = 'team-e2e';
const USER_ID = 'user-e2e';

function json(route: Route, value: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': 'http://127.0.0.1:3100',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': '*',
    },
    body: JSON.stringify(value),
  });
}

function functionResult(path: string) {
  if (path === '/billing/usage') return { ai_call: 0, token_input: 0, token_output: 0 };
  if (path === '/billing/plans')
    return [
      {
        id: 'free',
        name: 'Free',
        priceMonthlyUsd: 0,
        seats: 1,
        aiCallsPerMonth: 100,
        workflowLimit: 3,
      },
    ];
  if (path === '/billing/current') return null;
  if (
    ['/billing/requests', '/billing/invoices', '/billing/transactions', '/api-keys'].includes(path)
  )
    return [];
  if (path === '/billing/config') return { checkout: false };
  if (path === '/jobs') return { data: [], total: 0, limit: 25, offset: 0, nextOffset: null };
  if (path === '/health')
    return {
      status: 'ok',
      ai: {
        ready: true,
        provider: 'tokenrhythm',
        protocol: 'openai-chat-completions',
        model: 'deepseek-v4-flash-0731',
      },
      limits: { monthlyAiCalls: 100 },
    };
  if (path === '/admin/health')
    return {
      status: 'ok',
      release: 'e2e',
      timestamp: '2026-08-30T00:00:00.000Z',
      checks: {
        function: { status: 'ok' },
        provider: { status: 'ok' },
        asyncWorker: { status: 'ok' },
        billing: { status: 'degraded' },
      },
      ai: {
        ready: true,
        provider: 'tokenrhythm',
        protocol: 'openai-chat-completions',
        model: 'deepseek-v4-flash-0731',
        fallback: false,
      },
    };
  return {};
}

interface FunctionCall {
  path: string;
  method: string;
  body: Record<string, unknown>;
}

async function mockAuthenticatedAppwrite(
  page: Page,
  unexpected: string[],
  functionCalls: FunctionCall[] = [],
  options: { crmPagination?: boolean; authRequests?: string[] } = {},
) {
  await page.route(`${APPWRITE_ORIGIN}/v1/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') return json(route, {});
    if (url.pathname.startsWith('/v1/account/')) {
      options.authRequests?.push(`${request.method()} ${url.pathname}`);
      if (url.pathname === '/v1/account/tokens/email')
        return json(route, {
          $id: 'token-e2e',
          userId: USER_ID,
          secret: '',
          expire: '2026-08-30T00:15:00.000Z',
        });
      if (url.pathname === '/v1/account/sessions/email')
        return json(route, {
          $id: 'session-e2e',
          userId: USER_ID,
          expire: '2026-09-13T00:00:00.000Z',
          current: true,
        });
      if (url.pathname === '/v1/account/sessions/token')
        return json(route, {
          $id: 'session-token-e2e',
          userId: USER_ID,
          expire: '2026-09-13T00:00:00.000Z',
          current: true,
        });
      if (url.pathname === '/v1/account/sessions/current' && request.method() === 'DELETE')
        return json(route, {});
      if (url.pathname === '/v1/account/recovery')
        return json(route, {
          $id: 'recovery-e2e',
          userId: USER_ID,
          secret: '',
          expire: '2026-08-30T01:00:00.000Z',
        });
      if (url.pathname === '/v1/account/name' || url.pathname === '/v1/account/prefs')
        return json(route, {});
    }
    if (url.pathname === '/v1/account')
      return json(route, {
        $id: USER_ID,
        $createdAt: '2026-08-30T00:00:00.000Z',
        $updatedAt: '2026-08-30T00:00:00.000Z',
        name: 'E2E Owner',
        email: 'owner@example.test',
        emailVerification: true,
        phoneVerification: false,
        mfa: false,
        prefs: {},
        labels: [],
        status: true,
      });
    if (url.pathname === '/v1/teams')
      return json(route, {
        total: 1,
        teams: [
          {
            $id: TEAM_ID,
            $createdAt: '2026-08-30T00:00:00.000Z',
            $updatedAt: '2026-08-30T00:00:00.000Z',
            name: 'E2E Team',
            total: 1,
            prefs: {},
          },
        ],
      });
    if (url.pathname === `/v1/teams/${TEAM_ID}/memberships`)
      return json(route, {
        total: 1,
        memberships: [
          {
            $id: 'membership-e2e',
            $createdAt: '2026-08-30T00:00:00.000Z',
            $updatedAt: '2026-08-30T00:00:00.000Z',
            userId: USER_ID,
            teamId: TEAM_ID,
            roles: ['owner'],
            joined: '2026-08-30T00:00:00.000Z',
            confirm: true,
          },
        ],
      });
    if (options.crmPagination && url.pathname.includes('/tables/customers/rows'))
      return json(route, {
        total: 51,
        rows: [
          {
            $id: 'customer-e2e',
            $createdAt: '2026-08-30T00:00:00.000Z',
            $updatedAt: '2026-08-30T00:00:00.000Z',
            $permissions: [],
            organizationId: TEAM_ID,
            name: 'E2E Buyer',
            email: 'buyer@example.test',
            stage: 'NEW',
            tags: '[]',
            notes: '[]',
          },
        ],
      });
    if (options.crmPagination && url.pathname.includes('/tables/leads/rows'))
      return json(route, {
        total: 51,
        rows: [
          {
            $id: 'lead-e2e',
            $createdAt: '2026-08-30T00:00:00.000Z',
            $updatedAt: '2026-08-30T00:00:00.000Z',
            $permissions: [],
            organizationId: TEAM_ID,
            customerId: 'customer-e2e',
            score: 91,
            status: 'NEW',
          },
        ],
      });
    if (url.pathname.includes('/v1/tablesdb/') && url.pathname.endsWith('/rows'))
      return json(route, { total: 0, rows: [] });
    if (url.pathname === '/v1/functions/matrixflow-core/executions') {
      const input = JSON.parse(request.postData() || '{}') as {
        path?: string;
        xpath?: string;
        method?: string;
        body?: string;
      };
      const path = input.path || input.xpath || '/';
      const businessBody = JSON.parse(input.body || '{}') as Record<string, unknown>;
      functionCalls.push({ path, method: input.method || 'POST', body: businessBody });
      const result =
        path === '/agents'
          ? { id: 'agent-e2e', ...businessBody }
          : path.startsWith('/agents/from-template/')
            ? { id: 'agent-template-e2e', ...businessBody }
            : path === '/content/projects'
              ? { id: 'content-e2e', status: 'DRAFT', ...businessBody }
              : path === '/kb'
                ? { id: 'knowledge-e2e', ...businessBody }
                : path === '/workflows'
                  ? { id: 'workflow-e2e', status: 'DRAFT', ...businessBody }
                  : path === '/crm/customers'
                    ? { id: 'customer-e2e', stage: 'NEW', ...businessBody }
                    : functionResult(path);
      return json(route, {
        $id: 'execution-e2e',
        $createdAt: '2026-08-30T00:00:00.000Z',
        $updatedAt: '2026-08-30T00:00:00.000Z',
        status: 'completed',
        responseStatusCode: 200,
        responseBody: JSON.stringify({ data: result }),
        requestMethod: 'GET',
        requestPath: path,
        duration: 0.01,
      });
    }
    unexpected.push(`${request.method()} ${url.pathname}`);
    return json(route, { message: 'Unexpected E2E Appwrite request' }, 404);
  });
}

test('every primary dashboard surface renders with an authenticated Appwrite session', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(10_000);
  await context.addCookies([
    { name: 'matrixflow-locale', value: 'en', domain: '127.0.0.1', path: '/' },
  ]);
  const unexpected: string[] = [];
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await mockAuthenticatedAppwrite(page, unexpected);
  await page.setViewportSize({ width: 390, height: 844 });

  const routes = [
    '/dashboard',
    '/dashboard/agents',
    '/dashboard/agents/new',
    '/dashboard/content',
    '/dashboard/content/new',
    '/dashboard/knowledge',
    '/dashboard/knowledge/new',
    '/dashboard/workflows',
    '/dashboard/workflows/new',
    '/dashboard/crm',
    '/dashboard/marketplace',
    '/dashboard/marketplace/purchased',
    '/dashboard/analytics',
    '/dashboard/jobs',
    '/dashboard/billing',
    '/dashboard/settings',
    '/dashboard/admin',
  ];

  for (const path of routes) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path.replaceAll('/', '\\/')}(?:\\?.*)?$`));
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.getByText('Loading workspace')).toHaveCount(0);
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth, `${path} overflowed`).toBeLessThanOrEqual(
      dimensions.clientWidth + 1,
    );
  }

  expect(unexpected).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('primary creation forms validate and submit the intended tenant-scoped payloads', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await context.addCookies([
    { name: 'matrixflow-locale', value: 'en', domain: '127.0.0.1', path: '/' },
  ]);
  const unexpected: string[] = [];
  const functionCalls: FunctionCall[] = [];
  await mockAuthenticatedAppwrite(page, unexpected, functionCalls);

  await page.goto('/dashboard/agents/new');
  await page.getByRole('button', { name: 'Custom setup' }).click();
  await page.getByLabel('Role name').fill('E2E Copy Lead');
  await page.getByLabel('Role identifier').fill('copy_lead');
  await page.getByRole('button', { name: 'Create custom AI worker' }).click();
  await expect(page).toHaveURL(/\/dashboard\/agents$/);

  await page.goto('/dashboard/content');
  await page.getByRole('button', { name: 'New content project' }).click();
  await page.getByLabel('Project name').fill('E2E Launch');
  await page.getByLabel('Product benefits / description').fill('Fast, light, and durable.');
  await page.getByRole('button', { name: 'Create now' }).click();
  await expect(page.getByLabel('Project name')).toHaveCount(0);

  await page.goto('/dashboard/knowledge/new');
  await page.getByLabel('Name').fill('E2E Knowledge');
  await page.getByLabel('Description').fill('Verified product facts.');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/knowledge$/);

  await page.goto('/dashboard/workflows/new');
  await page.getByLabel('Name').fill('E2E Workflow');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/workflows$/);

  await page.goto('/dashboard/crm');
  await page.getByRole('button', { name: 'New customer' }).first().click();
  await page.getByLabel('Customer name').fill('E2E Buyer');
  await page.getByLabel('Customer email').fill('buyer@example.test');
  await page.locator('form').getByRole('button', { name: 'New customer', exact: true }).click();
  await expect(page.getByLabel('Customer name')).toHaveCount(0);

  expect(
    functionCalls
      .filter((call) =>
        ['/agents', '/content/projects', '/kb', '/workflows', '/crm/customers'].includes(call.path),
      )
      .map(({ path, method, body }) => ({ path, method, body })),
  ).toEqual([
    {
      path: '/agents',
      method: 'POST',
      body: expect.objectContaining({
        organizationId: TEAM_ID,
        name: 'E2E Copy Lead',
        role: 'copy_lead',
      }),
    },
    {
      path: '/content/projects',
      method: 'POST',
      body: expect.objectContaining({ organizationId: TEAM_ID, name: 'E2E Launch' }),
    },
    {
      path: '/kb',
      method: 'POST',
      body: expect.objectContaining({ organizationId: TEAM_ID, name: 'E2E Knowledge' }),
    },
    {
      path: '/workflows',
      method: 'POST',
      body: expect.objectContaining({ organizationId: TEAM_ID, name: 'E2E Workflow' }),
    },
    {
      path: '/crm/customers',
      method: 'POST',
      body: expect.objectContaining({
        organizationId: TEAM_ID,
        name: 'E2E Buyer',
        email: 'buyer@example.test',
      }),
    },
  ]);
  expect(unexpected).toEqual([]);
});

test('CRM keeps customer and lead pagination inside their respective regions', async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: 'matrixflow-locale', value: 'en', domain: '127.0.0.1', path: '/' },
  ]);
  const unexpected: string[] = [];
  await mockAuthenticatedAppwrite(page, unexpected, [], { crmPagination: true });
  await page.goto('/dashboard/crm');

  const customers = page.getByRole('region', { name: 'Buyer customer base' });
  const leads = page.getByRole('region', { name: 'Intent leads' });
  await expect(customers.getByRole('button', { name: 'Next' })).toBeVisible();
  await expect(leads.getByRole('button', { name: 'Next' })).toBeVisible();
  expect(unexpected).toEqual([]);
});

test('password, email-code, registration, and recovery journeys reach their success states', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(10_000);
  await context.addCookies([
    { name: 'matrixflow-locale', value: 'en', domain: '127.0.0.1', path: '/' },
  ]);
  const unexpected: string[] = [];
  const authRequests: string[] = [];
  await mockAuthenticatedAppwrite(page, unexpected, [], { authRequests });

  await page.goto('/login');
  await page.getByLabel('Email').fill('owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('local-test-password');
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('E2E Owner');

  await page.goto('/login');
  await page.getByRole('button', { name: 'Email code' }).click();
  await page.getByLabel('Email').fill('owner@example.test');
  await page.getByRole('button', { name: 'Send email code' }).click();
  await page.getByLabel('6-digit code').fill('123456');
  await page.getByRole('button', { name: 'Verify and enter' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/register');
  await page.getByLabel('Name').fill('E2E Owner');
  await page.getByLabel('Email').fill('new-owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('local-test-password');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Send email code' }).click();
  await page.getByLabel('6-digit code').fill('654321');
  await page.getByRole('button', { name: 'Verify and enter' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/recover');
  await page.getByLabel('Email').fill('owner@example.test');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByText('Check your inbox for the password reset link.')).toBeVisible();

  expect(authRequests).toEqual(
    expect.arrayContaining([
      'POST /v1/account/sessions/email',
      'POST /v1/account/tokens/email',
      'POST /v1/account/sessions/token',
      'POST /v1/account/recovery',
    ]),
  );
  expect(unexpected).toEqual([]);
});
