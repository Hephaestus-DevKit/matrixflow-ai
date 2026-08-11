import { Query } from 'appwrite';
import {
  createRow,
  deleteRow,
  executeCore,
  getRow,
  listRows,
  updateRow,
  uploadKnowledgeFile,
  BackendError,
} from './data';
import { TABLES } from './constants';

type Body = Record<string, unknown>;
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const TEMPLATES: Record<string, { role: string; prompt: string; skills: string[] }> = {
  tpl_copywriter: {
    role: 'copywriter',
    prompt: '你是专注跨境电商转化的资深文案专员。',
    skills: ['copywriting', 'localization'],
  },
  tpl_tiktok: {
    role: 'content_creator',
    prompt: '你是擅长短视频带货脚本与分镜策划的内容官。',
    skills: ['video_script', 'social'],
  },
  tpl_support: {
    role: 'customer_service',
    prompt: '你是严谨、友好且基于知识库回答的客服专员。',
    skills: ['rag', 'support'],
  },
  tpl_seo: {
    role: 'seo_writer',
    prompt: '你是遵循搜索质量原则的 SEO 内容分析师。',
    skills: ['seo', 'research'],
  },
  tpl_sales: {
    role: 'sales',
    prompt: '你是尊重客户意愿并善于个性化跟进的销售专员。',
    skills: ['sales', 'crm'],
  },
};

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    priceMonthlyUsd: 0,
    priceYearlyUsd: 0,
    seats: 3,
    aiCallsPerMonth: 100,
    workflowLimit: 5,
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthlyUsd: 29,
    priceYearlyUsd: 290,
    seats: 10,
    aiCallsPerMonth: 5000,
    workflowLimit: 100,
  },
  {
    id: 'team',
    name: 'Team',
    priceMonthlyUsd: 99,
    priceYearlyUsd: 990,
    seats: 50,
    aiCallsPerMonth: 25000,
    workflowLimit: 500,
  },
];

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
  const { segments } = parts(path);
  if (segments[0] === 'agents') {
    if (segments[1]) return summarizeAgent(await getRow(TABLES.agents, segments[1]));
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
      const workflow = await getRow(TABLES.workflows, segments[1]);
      return {
        ...workflow,
        versions: [
          {
            id: `${workflow.id}-v${workflow.currentVersion}`,
            version: workflow.currentVersion,
            dsl: workflow.dsl,
          },
        ],
      };
    }
    const workflows = await listRows(TABLES.workflows);
    const runs = await listRows(TABLES.workflowRuns);
    return workflows.map((workflow) => ({
      ...workflow,
      _count: { runs: runs.filter((run) => run.workflowId === workflow.id).length },
    }));
  }
  if (segments[0] === 'crm' && segments[1] === 'customers') {
    if (!segments[2]) return listRows(TABLES.customers);
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
    const [leads, customers] = await Promise.all([
      listRows(TABLES.leads),
      listRows(TABLES.customers),
    ]);
    return leads.map((lead) => ({
      ...lead,
      customer: customers.find((customer) => customer.id === lead.customerId) ?? null,
    }));
  }
  if (segments[0] === 'market' && segments[1] === 'items') {
    if (segments[2]) {
      const item = await getRow(TABLES.marketplaceItems, segments[2], 'ownerOrganizationId');
      const reviews = await listRows(TABLES.marketplaceReviews, [
        Query.equal('itemId', segments[2]),
      ]);
      return { ...item, reviews };
    }
    const data = await listRows(
      TABLES.marketplaceItems,
      [Query.equal('status', 'approved')],
      'ownerOrganizationId',
    );
    return { data, total: data.length, page: 1, pageSize: 100 };
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
  if (path === '/billing/plans') return PLANS;
  if (path === '/billing/current') return { id: 'free-local', status: 'active', plan: PLANS[0] };
  if (path === '/billing/usage') {
    const records = await listRows(TABLES.usageRecords);
    return records.reduce<Record<string, number>>((total, row) => {
      const metric = String(row.metric);
      total[metric] = (total[metric] ?? 0) + Number(row.value ?? 0);
      return total;
    }, {});
  }
  if (path === '/admin/revenue') {
    const usage = (await routeGet('/billing/usage')) as Record<string, number>;
    return {
      aiCalls: usage.ai_call ?? 0,
      tokenIn: usage.token_input ?? 0,
      tokenOut: usage.token_output ?? 0,
      aiCostUsd: Number(usage.cost_usd_micros ?? 0) / 1_000_000,
      marketplaceRevenueUsd: 0,
    };
  }
  if (path === '/admin/models') return [];
  if (path === '/admin/items/pending')
    return listRows(
      TABLES.marketplaceItems,
      [Query.equal('status', 'pending')],
      'ownerOrganizationId',
    );
  throw new BackendError('未找到请求的资源', 404, 'ROUTE_NOT_FOUND');
}

async function routeWrite(method: Method, path: string, rawBody: unknown) {
  const body = asBody(rawBody);
  const { segments } = parts(path);
  if (method === 'POST' && path === '/agents')
    return createRow(TABLES.agents, {
      name: body.name,
      role: body.role,
      model: 'glm-4-plus',
      status: 'ACTIVE',
      systemPrompt: body.systemPrompt ?? {},
      skills: body.skills ?? [],
      configuration: { tools: body.tools ?? [] },
    });
  if (method === 'POST' && segments[0] === 'agents' && segments[1] === 'from-template') {
    const template = TEMPLATES[segments[2]];
    if (!template) throw new BackendError('模板不存在', 404, 'TEMPLATE_NOT_FOUND');
    return createRow(TABLES.agents, {
      name: body.name,
      role: template.role,
      model: 'glm-4-plus',
      status: 'ACTIVE',
      systemPrompt: { raw: template.prompt },
      skills: template.skills,
      configuration: { templateId: segments[2] },
    });
  }
  if (method === 'POST' && path === '/content/projects')
    return createRow(TABLES.contentProjects, {
      name: body.name,
      productData: body.productData ?? {},
      status: 'ACTIVE',
    });
  if (
    method === 'POST' &&
    segments[0] === 'content' &&
    segments[1] === 'projects' &&
    segments[3] === 'generate'
  )
    return executeCore('/content/generate', { projectId: segments[2], ...body });
  if (
    method === 'POST' &&
    segments[0] === 'content' &&
    segments[1] === 'projects' &&
    segments[3] === 'generate-all'
  )
    return executeCore('/content/generate-all', { projectId: segments[2], ...body });
  if (method === 'POST' && path === '/kb')
    return createRow(TABLES.knowledgeBases, {
      name: body.name,
      description: body.description ?? '',
      status: 'ACTIVE',
    });
  if (method === 'POST' && segments[0] === 'kb' && segments[2] === 'ask')
    return executeCore('/kb/ask', { knowledgeBaseId: segments[1], ...body });
  if (method === 'POST' && path === '/workflows')
    return createRow(TABLES.workflows, {
      name: body.name,
      description: body.description ?? '',
      status: 'DRAFT',
      currentVersion: 1,
      dsl: body.dsl ?? { nodes: [], edges: [] },
    });
  if (method === 'POST' && segments[0] === 'workflows' && segments[2] === 'versions') {
    const current = await getRow(TABLES.workflows, segments[1]);
    return updateRow(TABLES.workflows, segments[1], {
      dsl: body.dsl,
      currentVersion: Number(current.currentVersion ?? 1) + 1,
      status: 'ACTIVE',
    });
  }
  if (method === 'POST' && segments[0] === 'workflows' && segments[2] === 'run')
    return executeCore('/workflow/run', { workflowId: segments[1] });
  if (
    method === 'POST' &&
    segments[0] === 'crm' &&
    segments[1] === 'conversations' &&
    segments[3] === 'messages'
  )
    return createRow(TABLES.messages, {
      conversationId: segments[2],
      role: body.role,
      content: body.content,
    });
  if (
    method === 'POST' &&
    segments[0] === 'crm' &&
    segments[1] === 'conversations' &&
    segments[3] === 'ai-reply'
  )
    return executeCore('/crm/ai-reply', { conversationId: segments[2] });
  if (
    method === 'POST' &&
    segments[0] === 'market' &&
    segments[1] === 'items' &&
    segments[3] === 'purchase'
  ) {
    const item = await getRow(TABLES.marketplaceItems, segments[2], 'ownerOrganizationId');
    return createRow(TABLES.marketplacePurchases, {
      itemId: item.id,
      priceUsd: item.priceUsd ?? 0,
      status: 'active',
    });
  }
  if (method === 'POST' && path === '/billing/subscribe') {
    if (body.planId !== 'free')
      throw new BackendError(
        '付费结账将在支付服务接入后开放，当前不会产生扣款',
        503,
        'PAYMENTS_DISABLED',
      );
    return {};
  }
  if (method === 'POST' && segments[0] === 'admin' && segments[1] === 'items')
    return updateRow(
      TABLES.marketplaceItems,
      segments[2],
      { status: segments[3] === 'approve' ? 'approved' : 'rejected' },
      'ownerOrganizationId',
    );
  if ((method === 'PUT' || method === 'PATCH') && segments[0] === 'agents' && segments[1])
    return updateRow(TABLES.agents, segments[1], body);
  if (method === 'DELETE' && segments[0] === 'agents' && segments[1])
    return deleteRow(TABLES.agents, segments[1]);
  throw new BackendError('该操作尚未开放', 404, 'ROUTE_NOT_FOUND');
}

export async function routeBackend(method: Method, path: string, body?: unknown) {
  return method === 'GET' ? routeGet(path) : routeWrite(method, path, body);
}

export async function routeUpload(path: string, body: FormData) {
  const { segments } = parts(path);
  if (segments[0] === 'kb' && segments[2] === 'documents')
    return uploadKnowledgeFile(segments[1], body);
  throw new BackendError('不支持该文件上传', 404, 'ROUTE_NOT_FOUND');
}
