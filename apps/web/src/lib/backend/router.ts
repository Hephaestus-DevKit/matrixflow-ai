import { ExecutionMethod, Query } from 'appwrite';
import {
  executeCore,
  getRow,
  listRows,
  listRowsPage,
  uploadKnowledgeFile,
  BackendError,
} from './data';
import { TABLES } from './constants';

type Body = Record<string, unknown>;
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function parts(path: string) {
  const url = new URL(path, 'https://matrixflow.local');
  return { segments: url.pathname.split('/').filter(Boolean), search: url.searchParams };
}

function asBody(body: unknown): Body {
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Body) : {};
}

function summarizeAgent(row: Body) {
  return {
    ...row,
    skills: Array.isArray(row.skills)
      ? row.skills.map((skill) => (typeof skill === 'string' ? { skillKey: skill } : skill))
      : [],
    runs: [],
  };
}

function wantsPage(search: URLSearchParams) {
  return search.has('limit') || search.has('offset');
}

function pageLimit(search: URLSearchParams, fallback = 50) {
  const value = Number(search.get('limit'));
  return Number.isFinite(value) ? Math.min(100, Math.max(1, Math.floor(value))) : fallback;
}

function pageOffset(search: URLSearchParams) {
  const value = Number(search.get('offset'));
  return Number.isFinite(value) ? Math.min(10_000_000, Math.max(0, Math.floor(value))) : 0;
}

function chunks<T>(items: T[], size = 100) {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    output.push(items.slice(index, index + size));
  return output;
}

async function routeGet(path: string) {
  const { segments, search } = parts(path);
  if (segments[0] === 'agents') {
    if (segments[1]) {
      const [agent, runs] = await Promise.all([
        getRow(TABLES.agents, segments[1]),
        listRows(TABLES.agentRuns, [Query.equal('agentId', segments[1])]),
      ]);
      return { ...summarizeAgent(agent), runs };
    }
    if (wantsPage(search)) {
      const page = await listRowsPage(TABLES.agents, [], 'organizationId', {
        limit: pageLimit(search),
        offset: pageOffset(search),
      });
      return { ...page, data: page.data.map(summarizeAgent) };
    }
    return (await listRows(TABLES.agents)).map(summarizeAgent);
  }
  if (segments[0] === 'content' && segments[1] === 'projects') {
    if (segments[2] && segments[3] === 'items')
      return listRows(TABLES.contentItems, [Query.equal('projectId', segments[2])]);
    if (wantsPage(search))
      return listRowsPage(TABLES.contentProjects, [], 'organizationId', {
        limit: pageLimit(search),
        offset: pageOffset(search),
      });
    return listRows(TABLES.contentProjects);
  }
  if (segments[0] === 'kb') {
    if (segments[1]) {
      const base = await getRow(TABLES.knowledgeBases, segments[1]);
      if (wantsPage(search)) {
        const documentsPage = await listRowsPage(
          TABLES.knowledgeDocuments,
          [Query.equal('knowledgeBaseId', segments[1])],
          'organizationId',
          {
            limit: pageLimit(search, 20),
            offset: pageOffset(search),
          },
        );
        return {
          ...base,
          documents: documentsPage.data,
          documentsPage,
          _count: { documents: documentsPage.total },
        };
      }
      const documents = await listRows(TABLES.knowledgeDocuments, [
        Query.equal('knowledgeBaseId', segments[1]),
      ]);
      return { ...base, documents, _count: { documents: documents.length } };
    }
    const basePage = wantsPage(search)
      ? await listRowsPage(TABLES.knowledgeBases, [], 'organizationId', {
          limit: pageLimit(search),
          offset: pageOffset(search),
        })
      : null;
    const bases = basePage?.data ?? (await listRows(TABLES.knowledgeBases));
    const baseIds = bases.map((base) => String(base.id));
    const documents = (
      await Promise.all(
        chunks(baseIds).map((ids) =>
          listRows(TABLES.knowledgeDocuments, [Query.equal('knowledgeBaseId', ids)]),
        ),
      )
    ).flat();
    const data = bases.map((base) => ({
      ...base,
      _count: { documents: documents.filter((doc) => doc.knowledgeBaseId === base.id).length },
    }));
    return basePage ? { ...basePage, data } : data;
  }
  if (segments[0] === 'workflows') {
    if (segments[1] && segments[2] === 'logs') {
      const queries = [Query.equal('workflowId', segments[1])];
      if (wantsPage(search))
        return listRowsPage(TABLES.workflowRuns, queries, 'organizationId', {
          limit: pageLimit(search, 25),
          offset: pageOffset(search),
        });
      return listRows(TABLES.workflowRuns, queries);
    }
    if (segments[1]) {
      const [workflow, versions] = await Promise.all([
        getRow(TABLES.workflows, segments[1]),
        listRows(TABLES.workflowVersions, [Query.equal('workflowId', segments[1])]),
      ]);
      return { ...workflow, versions };
    }
    const workflowPage = wantsPage(search)
      ? await listRowsPage(TABLES.workflows, [], 'organizationId', {
          limit: pageLimit(search),
          offset: pageOffset(search),
        })
      : null;
    const workflows = workflowPage?.data ?? (await listRows(TABLES.workflows));
    // Fetch the tenant's runs once and aggregate locally. The previous
    // implementation issued one Appwrite count query per workflow (N+1).
    const workflowIds = workflows.map((workflow) => String(workflow.id));
    const runs = (
      await Promise.all(
        chunks(workflowIds).map((ids) =>
          listRows(TABLES.workflowRuns, [Query.equal('workflowId', ids)]),
        ),
      )
    ).flat();
    const runCounts = new Map<string, number>();
    for (const run of runs) {
      const workflowId = String(run.workflowId ?? '');
      runCounts.set(workflowId, (runCounts.get(workflowId) ?? 0) + 1);
    }
    const data = workflows.map((workflow) => ({
      ...workflow,
      _count: { runs: runCounts.get(String(workflow.id)) ?? 0 },
    }));
    return workflowPage ? { ...workflowPage, data } : data;
  }
  if (segments[0] === 'crm' && segments[1] === 'customers') {
    if (!segments[2]) {
      const limit = pageLimit(search);
      const offset = pageOffset(search);
      return listRowsPage(TABLES.customers, [], 'organizationId', { limit, offset });
    }
    const customer = await getRow(TABLES.customers, segments[2]);
    const conversations = await listRows(TABLES.conversations, [
      Query.equal('customerId', segments[2]),
    ]);
    const conversationIds = conversations.map((conversation) => String(conversation.id));
    const messages = (
      await Promise.all(
        chunks(conversationIds).map((ids) =>
          listRows(TABLES.messages, [Query.equal('conversationId', ids)]),
        ),
      )
    ).flat();
    const messagesByConversation = new Map<string, Body[]>();
    for (const message of messages) {
      const conversationId = String(message.conversationId ?? '');
      const existing = messagesByConversation.get(conversationId) ?? [];
      existing.push(message);
      messagesByConversation.set(conversationId, existing);
    }
    const withMessages = conversations.map((conversation) => ({
      ...conversation,
      messages: messagesByConversation.get(String(conversation.id)) ?? [],
    }));
    const tags = Array.isArray(customer.tags)
      ? customer.tags.map((tag) => ({ tag: String(tag) }))
      : [];
    const notes = Array.isArray(customer.notes)
      ? customer.notes.map((content, index) => ({
          id: `${customer.id}-note-${index}`,
          content: String(content),
        }))
      : [];
    return { ...customer, tags, notes, conversations: withMessages };
  }
  if (segments[0] === 'crm' && segments[1] === 'leads') {
    const limit = pageLimit(search);
    const offset = pageOffset(search);
    const page = await listRowsPage(TABLES.leads, [], 'organizationId', { limit, offset });
    const customerIds = [
      ...new Set(page.data.map((lead) => String(lead.customerId ?? '')).filter(Boolean)),
    ];
    const customers = (
      await Promise.all(
        chunks(customerIds).map((ids) => listRows(TABLES.customers, [Query.equal('$id', ids)])),
      )
    ).flat();
    const customersById = new Map(customers.map((customer) => [String(customer.id), customer]));
    return {
      ...page,
      data: page.data.map((lead) => ({
        ...lead,
        customer: lead.customerId ? (customersById.get(String(lead.customerId)) ?? null) : null,
      })),
    };
  }
  if (segments[0] === 'market' && segments[1] === 'items') {
    if (segments[2]) throw new BackendError('模板市场仍在受控预览中', 404, 'MARKETPLACE_PREVIEW');
    return { data: [], total: 0, page: 1, pageSize: 24 };
  }
  if (segments[0] === 'market' && segments[1] === 'purchased') {
    const [purchases, items] = await Promise.all([
      listRows(TABLES.marketplacePurchases),
      listRows(TABLES.marketplaceItems, [], 'ownerOrganizationId'),
    ]);
    return purchases.map((purchase) => ({
      ...purchase,
      item: items.find((item) => item.id === purchase.itemId),
    }));
  }
  if (path === '/billing/plans') return executeCore('/billing/plans', {}, ExecutionMethod.GET);
  if (path === '/billing/config') return executeCore('/billing/config', {}, ExecutionMethod.GET);
  if (path === '/billing/current') return executeCore('/billing/current', {}, ExecutionMethod.GET);
  if (path === '/billing/requests')
    return executeCore('/billing/requests', {}, ExecutionMethod.GET);
  if (path === '/billing/invoices')
    return executeCore('/billing/invoices', {}, ExecutionMethod.GET);
  if (path === '/billing/transactions')
    return executeCore('/billing/transactions', {}, ExecutionMethod.GET);
  if (path === '/billing/usage') return executeCore('/billing/usage', {}, ExecutionMethod.GET);
  if (path === '/health') return executeCore('/health', {}, ExecutionMethod.GET);
  if (path === '/account/export') return executeCore('/account/export', {}, ExecutionMethod.GET);
  if (path === '/api-keys') return executeCore('/api-keys', {}, ExecutionMethod.GET);
  if (segments[0] === 'jobs' && !segments[1])
    return executeCore(
      '/jobs',
      {
        limit: pageLimit(search, 25),
        offset: pageOffset(search),
      },
      ExecutionMethod.GET,
    );
  if (path.startsWith('/jobs/')) return executeCore(path, {}, ExecutionMethod.GET);
  if (path === '/admin/health') return executeCore('/admin/health', {}, ExecutionMethod.GET);
  if (path.startsWith('/admin/'))
    throw new BackendError('管理模块正在安全重构中', 503, 'ADMIN_FEATURE_DISABLED');
  throw new BackendError('未找到请求的资源', 404, 'ROUTE_NOT_FOUND');
}

async function routeWrite(
  method: Method,
  path: string,
  rawBody: unknown,
  options: { idempotencyKey?: string } = {},
) {
  const body = asBody(rawBody);
  if (method === 'POST' && path === '/billing/subscribe') {
    throw new BackendError(
      '付费结账尚未开放，当前不会产生扣款。请通过产品页加入候补名单。',
      503,
      'PAYMENTS_DISABLED',
    );
  }
  if (path.startsWith('/market/') || path.startsWith('/admin/'))
    throw new BackendError('该模块仍在受控预览中，写入操作尚未开放', 503, 'FEATURE_PREVIEW');

  let executionMethod: ExecutionMethod;
  if (method === 'POST') executionMethod = ExecutionMethod.POST;
  else if (method === 'PUT') executionMethod = ExecutionMethod.PUT;
  else if (method === 'PATCH') executionMethod = ExecutionMethod.PATCH;
  else if (method === 'DELETE') executionMethod = ExecutionMethod.DELETE;
  else throw new BackendError('不支持的请求方法', 405, 'METHOD_NOT_ALLOWED');
  return executeCore(path, body, executionMethod, options);
}

export async function routeBackend(
  method: Method,
  path: string,
  body?: unknown,
  options: { idempotencyKey?: string } = {},
) {
  return method === 'GET' ? routeGet(path) : routeWrite(method, path, body, options);
}

export async function routeUpload(
  path: string,
  body: FormData,
  options: { idempotencyKey?: string } = {},
) {
  const { segments } = parts(path);
  if (segments[0] === 'kb' && segments[2] === 'documents')
    return uploadKnowledgeFile(segments[1], body, options);
  throw new BackendError('不支持该文件上传', 404, 'ROUTE_NOT_FOUND');
}
