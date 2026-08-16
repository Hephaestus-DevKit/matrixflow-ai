import { ExecutionMethod, Query } from 'appwrite';
import {
  countRows,
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
    return (await listRows(TABLES.agents)).map(summarizeAgent);
  }
  if (segments[0] === 'content' && segments[1] === 'projects') {
    if (segments[2] && segments[3] === 'items')
      return listRows(TABLES.contentItems, [Query.equal('projectId', segments[2])]);
    return listRows(TABLES.contentProjects);
  }
  if (segments[0] === 'kb') {
    if (segments[1]) {
      const base = await getRow(TABLES.knowledgeBases, segments[1]);
      const documents = await listRows(TABLES.knowledgeDocuments, [
        Query.equal('knowledgeBaseId', segments[1]),
      ]);
      return { ...base, documents, _count: { documents: documents.length } };
    }
    const bases = await listRows(TABLES.knowledgeBases);
    const documents = await listRows(TABLES.knowledgeDocuments);
    return bases.map((base) => ({
      ...base,
      _count: { documents: documents.filter((doc) => doc.knowledgeBaseId === base.id).length },
    }));
  }
  if (segments[0] === 'workflows') {
    if (segments[1] && segments[2] === 'logs')
      return listRows(TABLES.workflowRuns, [Query.equal('workflowId', segments[1])]);
    if (segments[1]) {
      const [workflow, versions] = await Promise.all([
        getRow(TABLES.workflows, segments[1]),
        listRows(TABLES.workflowVersions, [Query.equal('workflowId', segments[1])]),
      ]);
      return { ...workflow, versions };
    }
    const workflows = await listRows(TABLES.workflows);
    return Promise.all(
      workflows.map(async (workflow) => ({
        ...workflow,
        _count: {
          runs: await countRows(TABLES.workflowRuns, [
            Query.equal('workflowId', String(workflow.id)),
          ]),
        },
      })),
    );
  }
  if (segments[0] === 'crm' && segments[1] === 'customers') {
    if (!segments[2]) {
      const limit = Number(search.get('limit') || 50);
      const offset = Number(search.get('offset') || 0);
      return listRowsPage(TABLES.customers, [], 'organizationId', { limit, offset });
    }
    const customer = await getRow(TABLES.customers, segments[2]);
    const conversations = await listRows(TABLES.conversations, [
      Query.equal('customerId', segments[2]),
    ]);
    const withMessages = await Promise.all(
      conversations.map(async (conversation) => ({
        ...conversation,
        messages: await listRows(TABLES.messages, [
          Query.equal('conversationId', String(conversation.id)),
        ]),
      })),
    );
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
    const limit = Number(search.get('limit') || 50);
    const offset = Number(search.get('offset') || 0);
    const page = await listRowsPage(TABLES.leads, [], 'organizationId', { limit, offset });
    const customers = await Promise.all(
      page.data.map(async (lead) => {
        if (!lead.customerId) return null;
        try {
          return await getRow(TABLES.customers, String(lead.customerId));
        } catch {
          return null;
        }
      }),
    );
    return {
      ...page,
      data: page.data.map((lead, index) => ({ ...lead, customer: customers[index] })),
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
  if (path === '/jobs') return executeCore('/jobs', {}, ExecutionMethod.GET);
  if (path.startsWith('/jobs/')) return executeCore(path, {}, ExecutionMethod.GET);
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
