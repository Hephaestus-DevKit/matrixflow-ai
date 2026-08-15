import { configuredProvider, providerCapabilities } from './provider.js';
import { Query } from 'node-appwrite';
import {
  askKnowledgeBase,
  crmReply,
  generateAllContent,
  generateContent,
  indexDocument,
  runAgent,
  runWorkflow,
} from './features.js';
import {
  BUCKET_ID,
  HttpError,
  TABLES,
  createRow,
  deleteOwned,
  getOwned,
  listRows,
  recordAudit,
  requestBody,
  requireAdmin,
  requireCapability,
  requireTeamMember,
  serverClient,
  updateOwned,
} from './runtime.js';
import { parse, schemas } from './schemas.js';

const TEMPLATES = {
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
    prompt: '你是严谨、友好且仅基于知识库回答的客服专员。',
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

function routeParts(path) {
  return path.split('/').filter(Boolean);
}

function providerReadiness() {
  try {
    const provider = configuredProvider();
    return {
      ready: true,
      provider: provider.name,
      protocol: provider.protocol,
      model: provider.model,
      capabilities: providerCapabilities,
    };
  } catch (error) {
    return {
      ready: false,
      code: error.code || 'AI_PROVIDER_UNAVAILABLE',
      capabilities: providerCapabilities,
    };
  }
}

async function handleRoute({ services, context, membership, path, method, body }) {
  const segments = routeParts(path);
  const ai = providerReadiness();

  if (path === '/health') {
    return {
      status: 'ok',
      architecture: 'appwrite-native',
      database: { ready: true },
      ai,
      limits: {
        monthlyAiCalls: Number(process.env.MATRIXFLOW_AI_MONTHLY_LIMIT || 100),
        aiCallsPerMinute: Number(process.env.MATRIXFLOW_AI_PER_MINUTE_LIMIT || 20),
      },
    };
  }

  if (method === 'POST' && path === '/agents') {
    requireCapability(membership, 'agents.manage');
    const input = parse(schemas.agentCreate, body);
    const agent = await createRow(services, TABLES.agents, context.teamId, {
      name: input.name,
      role: input.role,
      model: input.model || ai.model || 'not-configured',
      status: ai.ready ? 'ACTIVE' : 'DRAFT',
      systemPrompt: input.systemPrompt,
      skills: input.skills,
      configuration: {
        tools: input.tools,
        ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
        ...(input.maxTokens === undefined ? {} : { maxTokens: input.maxTokens }),
        ...(input.topP === undefined ? {} : { topP: input.topP }),
      },
    });
    await recordAudit(services, context, 'agent.created', 'agent', agent.id);
    return agent;
  }

  if (method === 'POST' && segments[0] === 'agents' && segments[1] === 'from-template') {
    requireCapability(membership, 'agents.manage');
    const template = TEMPLATES[segments[2]];
    if (!template) throw new HttpError('模板不存在', 404, 'TEMPLATE_NOT_FOUND');
    const input = parse(schemas.agentCreate.pick({ name: true }), body);
    const agent = await createRow(services, TABLES.agents, context.teamId, {
      name: input.name,
      role: template.role,
      model: ai.model || 'not-configured',
      status: ai.ready ? 'ACTIVE' : 'DRAFT',
      systemPrompt: { raw: template.prompt },
      skills: template.skills,
      configuration: { templateId: segments[2], tools: [] },
    });
    await recordAudit(services, context, 'agent.created_from_template', 'agent', agent.id, {
      templateId: segments[2],
    });
    return agent;
  }

  if ((method === 'PATCH' || method === 'PUT') && segments[0] === 'agents' && segments[1]) {
    requireCapability(membership, 'agents.manage');
    const input = parse(schemas.agentUpdate, body);
    const current = await getOwned(services, TABLES.agents, segments[1], context.teamId);
    const configuration =
      input.tools === undefined &&
      input.temperature === undefined &&
      input.maxTokens === undefined &&
      input.topP === undefined
        ? undefined
        : {
            ...(current.configuration || {}),
            ...(input.tools === undefined ? {} : { tools: input.tools }),
            ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
            ...(input.maxTokens === undefined ? {} : { maxTokens: input.maxTokens }),
            ...(input.topP === undefined ? {} : { topP: input.topP }),
          };
    const requestedStatus = input.status === 'ACTIVE' && !ai.ready ? 'DRAFT' : input.status;
    const updated = await updateOwned(services, TABLES.agents, segments[1], context.teamId, {
      name: input.name,
      role: input.role,
      model: input.model,
      systemPrompt: input.systemPrompt,
      skills: input.skills,
      status: requestedStatus,
      configuration,
    });
    await recordAudit(services, context, 'agent.updated', 'agent', updated.id);
    return updated;
  }

  if (method === 'DELETE' && segments[0] === 'agents' && segments[1]) {
    requireCapability(membership, 'agents.manage');
    const deleted = await deleteOwned(services, TABLES.agents, segments[1], context.teamId);
    await recordAudit(services, context, 'agent.deleted', 'agent', deleted.id);
    return { deleted: true };
  }

  if (method === 'POST' && segments[0] === 'agents' && segments[2] === 'run') {
    requireCapability(membership, 'agents.manage');
    return runAgent(services, context, {
      agentId: segments[1],
      ...parse(schemas.agentRun, body),
    });
  }

  if (method === 'POST' && path === '/content/projects') {
    requireCapability(membership, 'content.manage');
    const input = parse(schemas.contentProject, body);
    const project = await createRow(services, TABLES.contentProjects, context.teamId, {
      ...input,
      status: 'ACTIVE',
    });
    await recordAudit(services, context, 'content_project.created', 'content_project', project.id);
    return project;
  }

  if (
    method === 'POST' &&
    segments[0] === 'content' &&
    segments[1] === 'projects' &&
    segments[3] === 'generate'
  ) {
    requireCapability(membership, 'content.manage');
    return generateContent(services, context, {
      projectId: segments[2],
      ...parse(schemas.contentGenerate, body),
    });
  }

  if (
    method === 'POST' &&
    segments[0] === 'content' &&
    segments[1] === 'projects' &&
    segments[3] === 'generate-all'
  ) {
    requireCapability(membership, 'content.manage');
    return generateAllContent(services, context, {
      projectId: segments[2],
      ...parse(schemas.contentGenerate, body),
    });
  }

  if (
    method === 'DELETE' &&
    segments[0] === 'content' &&
    segments[1] === 'projects' &&
    segments[2]
  ) {
    requireCapability(membership, 'content.manage');
    const items = await listRows(services, TABLES.contentItems, context.teamId, [
      Query.equal('projectId', segments[2]),
    ]);
    await Promise.all(
      items.map((item) => deleteOwned(services, TABLES.contentItems, item.id, context.teamId)),
    );
    await deleteOwned(services, TABLES.contentProjects, segments[2], context.teamId);
    await recordAudit(
      services,
      context,
      'content_project.deleted',
      'content_project',
      segments[2],
      {
        deletedItems: items.length,
      },
    );
    return { deleted: true };
  }

  if (method === 'POST' && path === '/kb') {
    requireCapability(membership, 'knowledge.manage');
    const input = parse(schemas.knowledgeBase, body);
    const base = await createRow(services, TABLES.knowledgeBases, context.teamId, {
      ...input,
      status: 'ACTIVE',
    });
    await recordAudit(services, context, 'knowledge_base.created', 'knowledge_base', base.id);
    return base;
  }

  if (method === 'POST' && path === '/kb/documents') {
    requireCapability(membership, 'knowledge.manage');
    const input = parse(schemas.knowledgeDocument, body);
    await getOwned(services, TABLES.knowledgeBases, input.knowledgeBaseId, context.teamId);
    const document = await createRow(services, TABLES.knowledgeDocuments, context.teamId, {
      ...input,
      status: 'UPLOADED',
    });
    await recordAudit(
      services,
      context,
      'knowledge_document.created',
      'knowledge_document',
      document.id,
    );
    return document;
  }

  if (method === 'POST' && path === '/kb/index') {
    requireCapability(membership, 'knowledge.manage');
    return indexDocument(services, context, { documentId: String(body.documentId || '') });
  }

  if (method === 'POST' && segments[0] === 'kb' && segments[2] === 'ask') {
    requireCapability(membership, 'knowledge.manage');
    return askKnowledgeBase(services, context, {
      knowledgeBaseId: segments[1],
      ...parse(schemas.knowledgeAsk, body),
    });
  }

  if (method === 'DELETE' && segments[0] === 'kb' && segments[2] === 'documents' && segments[3]) {
    requireCapability(membership, 'knowledge.manage');
    const document = await getOwned(
      services,
      TABLES.knowledgeDocuments,
      segments[3],
      context.teamId,
    );
    if (document.knowledgeBaseId !== segments[1])
      throw new HttpError('文档不属于该知识库', 403, 'FORBIDDEN');
    await services.storage.deleteFile({ bucketId: BUCKET_ID, fileId: document.fileId });
    await deleteOwned(services, TABLES.knowledgeDocuments, document.id, context.teamId);
    await recordAudit(
      services,
      context,
      'knowledge_document.deleted',
      'knowledge_document',
      document.id,
    );
    return { deleted: true };
  }

  if (method === 'DELETE' && segments[0] === 'kb' && segments[1] && !segments[2]) {
    requireCapability(membership, 'knowledge.manage');
    const documents = await listRows(services, TABLES.knowledgeDocuments, context.teamId, [
      Query.equal('knowledgeBaseId', segments[1]),
    ]);
    for (const document of documents) {
      await services.storage
        .deleteFile({ bucketId: BUCKET_ID, fileId: document.fileId })
        .catch(() => undefined);
      await deleteOwned(services, TABLES.knowledgeDocuments, document.id, context.teamId);
    }
    await deleteOwned(services, TABLES.knowledgeBases, segments[1], context.teamId);
    await recordAudit(services, context, 'knowledge_base.deleted', 'knowledge_base', segments[1], {
      deletedDocuments: documents.length,
    });
    return { deleted: true };
  }

  if (method === 'POST' && path === '/workflows') {
    requireCapability(membership, 'workflows.manage');
    const input = parse(schemas.workflowCreate, body);
    const workflow = await createRow(services, TABLES.workflows, context.teamId, {
      ...input,
      status: 'DRAFT',
      currentVersion: 1,
    });
    await createRow(services, TABLES.workflowVersions, context.teamId, {
      workflowId: workflow.id,
      version: 1,
      dsl: input.dsl,
      createdBy: context.userId,
    });
    await recordAudit(services, context, 'workflow.created', 'workflow', workflow.id);
    return workflow;
  }

  if (method === 'POST' && segments[0] === 'workflows' && segments[2] === 'versions') {
    requireCapability(membership, 'workflows.manage');
    const input = parse(schemas.workflowVersion, body);
    const workflow = await getOwned(services, TABLES.workflows, segments[1], context.teamId);
    const version = Number(workflow.currentVersion || 1) + 1;
    await createRow(services, TABLES.workflowVersions, context.teamId, {
      workflowId: workflow.id,
      version,
      dsl: input.dsl,
      createdBy: context.userId,
    });
    const updated = await updateOwned(services, TABLES.workflows, workflow.id, context.teamId, {
      dsl: input.dsl,
      currentVersion: version,
      status: 'ACTIVE',
    });
    await recordAudit(services, context, 'workflow.version_created', 'workflow', workflow.id, {
      version,
      changeNote: input.changeNote,
    });
    return updated;
  }

  if (method === 'POST' && segments[0] === 'workflows' && segments[2] === 'run') {
    requireCapability(membership, 'workflows.manage');
    return runWorkflow(services, context, {
      workflowId: segments[1],
      ...parse(schemas.workflowRun, body),
    });
  }

  if (method === 'DELETE' && segments[0] === 'workflows' && segments[1] && !segments[2]) {
    requireCapability(membership, 'workflows.manage');
    const [versions, runs] = await Promise.all([
      listRows(services, TABLES.workflowVersions, context.teamId, [
        Query.equal('workflowId', segments[1]),
      ]),
      listRows(services, TABLES.workflowRuns, context.teamId, [
        Query.equal('workflowId', segments[1]),
      ]),
    ]);
    await Promise.all([
      ...versions.map((version) =>
        deleteOwned(services, TABLES.workflowVersions, version.id, context.teamId),
      ),
      ...runs.map((run) => deleteOwned(services, TABLES.workflowRuns, run.id, context.teamId)),
    ]);
    await deleteOwned(services, TABLES.workflows, segments[1], context.teamId);
    await recordAudit(services, context, 'workflow.deleted', 'workflow', segments[1], {
      deletedVersions: versions.length,
      deletedRuns: runs.length,
    });
    return { deleted: true };
  }

  if (method === 'POST' && path === '/crm/customers') {
    requireCapability(membership, 'crm.manage');
    const input = parse(schemas.customer, body);
    const customer = await createRow(services, TABLES.customers, context.teamId, {
      ...input,
      stage: 'prospect',
      tags: [],
      notes: [],
    });
    await createRow(services, TABLES.conversations, context.teamId, {
      customerId: customer.id,
      channel: 'internal',
      status: 'open',
      summary: '手动创建的内部对话',
    });
    await recordAudit(services, context, 'crm.customer_created', 'customer', customer.id);
    return customer;
  }

  if (
    method === 'POST' &&
    segments[0] === 'crm' &&
    segments[1] === 'conversations' &&
    segments[3] === 'messages'
  ) {
    requireCapability(membership, 'crm.manage');
    await getOwned(services, TABLES.conversations, segments[2], context.teamId);
    const input = parse(schemas.message, body);
    const message = await createRow(services, TABLES.messages, context.teamId, {
      conversationId: segments[2],
      ...input,
    });
    await recordAudit(services, context, 'crm.message_added', 'conversation', segments[2]);
    return message;
  }

  if (
    method === 'POST' &&
    segments[0] === 'crm' &&
    segments[1] === 'conversations' &&
    segments[3] === 'ai-reply'
  ) {
    requireCapability(membership, 'crm.manage');
    return crmReply(services, context, { conversationId: segments[2] });
  }

  if (segments[0] === 'admin') {
    requireAdmin(membership);
    throw new HttpError('管理功能正在安全重构中', 503, 'ADMIN_FEATURE_DISABLED');
  }

  throw new HttpError('函数路由不存在', 404, 'ROUTE_NOT_FOUND');
}

export default async ({ req, res, log, error: logError }) => {
  const requestId = req.headers['x-appwrite-execution-id'] || crypto.randomUUID();
  const startedAt = Date.now();
  try {
    const userId = req.headers['x-appwrite-user-id'];
    if (!userId) throw new HttpError('请先登录', 401, 'UNAUTHENTICATED');
    const body = requestBody(req);
    const teamId = body.organizationId;
    const payload = { ...body };
    delete payload.organizationId;
    const services = serverClient(req);
    const membership = await requireTeamMember(services, teamId, userId);
    const context = { teamId, userId, requestId };
    const data = await handleRoute({
      services,
      context,
      membership,
      path: req.path || '/',
      method: String(req.method || 'POST').toUpperCase(),
      body: payload,
    });
    log?.(
      JSON.stringify({
        requestId,
        path: req.path,
        status: 200,
        durationMs: Date.now() - startedAt,
      }),
    );
    return res.json({ data, meta: { requestId } }, 200);
  } catch (caught) {
    const status = Number(caught?.status || 500);
    logError?.(
      JSON.stringify({
        requestId,
        path: req.path,
        status,
        code: caught?.code || 'INTERNAL_ERROR',
        durationMs: Date.now() - startedAt,
      }),
    );
    const message =
      status >= 500 && !caught?.code ? '核心服务暂时不可用' : String(caught?.message || '请求失败');
    return res.json(
      {
        error: {
          code: caught?.code || 'INTERNAL_ERROR',
          message,
          details: caught?.details,
          requestId,
        },
      },
      status,
    );
  }
};
