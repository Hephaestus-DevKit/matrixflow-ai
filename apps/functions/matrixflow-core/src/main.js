import { Client, ID, Permission, Query, Role, Storage, TablesDB, Teams } from 'node-appwrite';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { edgeAllows, evaluateCondition, interpolate, validateDag } from './dag.js';
import { generateText } from './provider.js';

const DATABASE_ID = process.env.MATRIXFLOW_DATABASE_ID || 'matrixflow';
const BUCKET_ID = process.env.MATRIXFLOW_KNOWLEDGE_BUCKET_ID || 'knowledge-files';
const MAX_BODY_BYTES = 128 * 1024;
const MAX_KB_CONTEXT = 12_000;

const TABLES = {
  contentProjects: 'content_projects',
  contentItems: 'content_items',
  knowledgeBases: 'knowledge_bases',
  knowledgeDocuments: 'knowledge_documents',
  workflows: 'workflows',
  workflowRuns: 'workflow_runs',
  conversations: 'conversations',
  messages: 'messages',
  usageRecords: 'usage_records',
  auditLogs: 'audit_logs',
};

class HttpError extends Error {
  constructor(message, status = 400, code = 'BAD_REQUEST') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function serverClient(req) {
  const key = req.headers['x-appwrite-key'];
  if (!key) throw new HttpError('函数运行凭证缺失', 500, 'FUNCTION_KEY_MISSING');
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(key);
  return { tables: new TablesDB(client), teams: new Teams(client), storage: new Storage(client) };
}

function requestBody(req) {
  if (req.bodyJson && typeof req.bodyJson === 'object') return req.bodyJson;
  const text = typeof req.bodyText === 'string' ? req.bodyText : '';
  if (Buffer.byteLength(text) > MAX_BODY_BYTES)
    throw new HttpError('请求内容过大', 413, 'BODY_TOO_LARGE');
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError('请求内容不是有效 JSON');
  }
}

function permissions(teamId) {
  return [
    Permission.read(Role.team(teamId)),
    Permission.update(Role.team(teamId)),
    Permission.delete(Role.team(teamId, 'owner')),
    Permission.delete(Role.team(teamId, 'admin')),
  ];
}

function encode(data) {
  const jsonFields = new Set(['body', 'metadata', 'dsl', 'output', 'logs']);
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [
        key,
        jsonFields.has(key) && typeof value !== 'string' ? JSON.stringify(value) : value,
      ]),
  );
}

function decode(row) {
  const result = { id: row.$id, createdAt: row.$createdAt };
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith('$')) continue;
    if (['body', 'metadata', 'dsl', 'output', 'logs'].includes(key) && typeof value === 'string') {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    } else result[key] = value;
  }
  return result;
}

async function requireTeamMember(services, teamId, userId) {
  if (typeof teamId !== 'string' || !teamId)
    throw new HttpError('缺少团队空间', 400, 'ORGANIZATION_REQUIRED');
  const members = await services.teams.listMemberships({
    teamId,
    queries: [Query.equal('userId', userId), Query.limit(1)],
  });
  if (!members.memberships.length) throw new HttpError('无权访问该团队空间', 403, 'FORBIDDEN');
}

async function getOwned(services, tableId, rowId, teamId) {
  const row = decode(await services.tables.getRow({ databaseId: DATABASE_ID, tableId, rowId }));
  if (row.organizationId !== teamId) throw new HttpError('无权访问该资源', 403, 'FORBIDDEN');
  return row;
}

async function create(services, tableId, teamId, data) {
  return decode(
    await services.tables.createRow({
      databaseId: DATABASE_ID,
      tableId,
      rowId: ID.unique(),
      data: encode({ ...data, organizationId: teamId }),
      permissions: permissions(teamId),
    }),
  );
}

async function update(services, tableId, rowId, data) {
  return decode(
    await services.tables.updateRow({
      databaseId: DATABASE_ID,
      tableId,
      rowId,
      data: encode(data),
    }),
  );
}

async function list(services, tableId, teamId, queries = []) {
  const result = await services.tables.listRows({
    databaseId: DATABASE_ID,
    tableId,
    queries: [Query.equal('organizationId', teamId), ...queries, Query.limit(100)],
  });
  return result.rows.map(decode);
}

async function recordUsage(services, teamId, generated) {
  const records = [
    ['ai_call', 1],
    ['token_input', generated.usage.inputTokens],
    ['token_output', generated.usage.outputTokens],
  ];
  await Promise.all(
    records.map(([metric, value]) =>
      create(services, TABLES.usageRecords, teamId, {
        metric,
        value,
        metadata: { provider: generated.provider, model: generated.model },
        recordedAt: new Date().toISOString(),
      }),
    ),
  );
}

async function generateContent(services, teamId, body) {
  const project = await getOwned(services, TABLES.contentProjects, body.projectId, teamId);
  const type = String(body.type || 'listing').slice(0, 64);
  const generated = await generateText({
    system: '你是资深跨境电商内容策略师。输出可直接使用、事实克制、不虚构产品参数的内容。',
    prompt: `内容类型：${type}\n目标语言：${body.variables?.language || body.language || 'en'}\n产品资料：${JSON.stringify(project.productData || {})}`,
  });
  const item = await create(services, TABLES.contentItems, teamId, {
    projectId: project.id,
    type,
    status: 'READY',
    body: { raw: generated.content },
    metadata: { usage: generated.usage, provider: generated.provider, model: generated.model },
  });
  await recordUsage(services, teamId, generated);
  return { itemId: item.id, content: generated.content, usage: generated.usage };
}

async function indexDocument(services, teamId, body) {
  const document = await getOwned(services, TABLES.knowledgeDocuments, body.documentId, teamId);
  const file = await services.storage.getFileDownload({
    bucketId: BUCKET_ID,
    fileId: document.fileId,
  });
  const buffer = Buffer.from(file);
  let text = '';
  try {
    if (document.mimeType === 'application/pdf' || document.title.toLowerCase().endsWith('.pdf')) {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      text = result.text;
    } else if (
      document.mimeType.includes('wordprocessingml') ||
      document.title.toLowerCase().endsWith('.docx')
    ) {
      text = (await mammoth.extractRawText({ buffer })).value;
    } else text = buffer.toString('utf8');
    text = text
      .replace(/\u0000/g, '')
      .trim()
      .slice(0, 90_000);
    if (!text) throw new HttpError('文档中没有可索引的文字', 422, 'EMPTY_DOCUMENT');
    return update(services, TABLES.knowledgeDocuments, document.id, {
      extractedText: text,
      status: 'READY',
      error: '',
    });
  } catch (error) {
    await update(services, TABLES.knowledgeDocuments, document.id, {
      status: 'ERROR',
      error: String(error?.message || '文档解析失败').slice(0, 1000),
    });
    throw error;
  }
}

function keywordScore(text, question) {
  const terms = question
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 1);
  const lower = text.toLowerCase();
  return terms.reduce((score, term) => score + (lower.includes(term) ? 1 : 0), 0);
}

async function askKnowledgeBase(services, teamId, body) {
  await getOwned(services, TABLES.knowledgeBases, body.knowledgeBaseId, teamId);
  const question = String(body.question || '').trim();
  if (!question) throw new HttpError('问题不能为空');
  const documents = await list(services, TABLES.knowledgeDocuments, teamId, [
    Query.equal('knowledgeBaseId', body.knowledgeBaseId),
    Query.equal('status', 'READY'),
  ]);
  const ranked = documents
    .map((doc) => ({ ...doc, score: keywordScore(String(doc.extractedText || ''), question) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const context = ranked
    .map((doc) => `[${doc.title}]\n${String(doc.extractedText || '').slice(0, 3500)}`)
    .join('\n\n')
    .slice(0, MAX_KB_CONTEXT);
  if (!context) throw new HttpError('知识库还没有完成索引的文档', 422, 'KNOWLEDGE_BASE_EMPTY');
  const generated = await generateText({
    system: '只根据提供的知识库上下文回答；资料不足时明确说明，不得编造。',
    prompt: `问题：${question}\n\n知识库上下文：\n${context}`,
  });
  await recordUsage(services, teamId, generated);
  return {
    answer: generated.content,
    citations: ranked.map((doc) => ({
      docId: doc.id,
      chunkId: `${doc.id}-0`,
      snippet: String(doc.extractedText || '').slice(0, 180),
      title: doc.title,
      score: doc.score,
    })),
  };
}

async function runWorkflow(services, teamId, body) {
  const workflow = await getOwned(services, TABLES.workflows, body.workflowId, teamId);
  const dag = validateDag(workflow.dsl);
  const run = await create(services, TABLES.workflowRuns, teamId, {
    workflowId: workflow.id,
    status: 'RUNNING',
    version: workflow.currentVersion || 1,
    triggerType: 'manual',
    output: {},
    logs: [],
  });
  const started = Date.now();
  const values = { input: body.input || {}, nodes: {} };
  const logs = [];
  try {
    for (const node of dag.order) {
      const config = node.config || {};
      const incoming = dag.edges.filter((edge) => edge.target === node.id);
      const active =
        incoming.length === 0 ||
        incoming.some(
          (edge) =>
            Object.hasOwn(values.nodes, edge.source) && edgeAllows(edge, values.nodes[edge.source]),
        );
      if (!active) {
        logs.push({ nodeId: node.id, status: 'SKIPPED', at: new Date().toISOString() });
        continue;
      }
      if (node.type === 'email' || node.type === 'webhook')
        throw new HttpError(`${node.type} 节点尚未配置安全连接器`, 422, 'CONNECTOR_NOT_CONFIGURED');
      let output = values.input;
      if (node.type === 'ai') {
        const generated = await generateText({
          system: String(config.system || ''),
          prompt: interpolate(config.prompt || config.promptKey || '{{input}}', values),
        });
        output = generated.content;
        await recordUsage(services, teamId, generated);
      } else if (node.type === 'transform')
        output = interpolate(config.template || '{{input}}', values);
      else if (node.type === 'condition') output = evaluateCondition(config, values);
      values.nodes[node.id] = output;
      logs.push({ nodeId: node.id, status: 'COMPLETED', at: new Date().toISOString() });
    }
    await update(services, TABLES.workflowRuns, run.id, {
      status: 'COMPLETED',
      output: values,
      logs,
      durationMs: Date.now() - started,
    });
    return { runId: run.id, status: 'COMPLETED', output: values };
  } catch (error) {
    await update(services, TABLES.workflowRuns, run.id, {
      status: 'FAILED',
      output: values,
      logs,
      error: String(error?.message || '执行失败').slice(0, 1000),
      durationMs: Date.now() - started,
    });
    throw error;
  }
}

async function crmReply(services, teamId, body) {
  const conversation = await getOwned(services, TABLES.conversations, body.conversationId, teamId);
  const messages = await list(services, TABLES.messages, teamId, [
    Query.equal('conversationId', conversation.id),
    Query.orderAsc('$createdAt'),
  ]);
  const generated = await generateText({
    system: '你是专业、简洁且不作超出公司政策承诺的客服助理。',
    prompt: `请根据以下最近对话给出回复建议：\n${messages
      .slice(-20)
      .map((message) => `${message.role}: ${message.content}`)
      .join('\n')}`,
  });
  await recordUsage(services, teamId, generated);
  return { reply: generated.content };
}

export default async ({ req, res, error: logError }) => {
  try {
    const userId = req.headers['x-appwrite-user-id'];
    if (!userId) throw new HttpError('请先登录', 401, 'UNAUTHENTICATED');
    const body = requestBody(req);
    const teamId = body.organizationId;
    const services = serverClient(req);
    await requireTeamMember(services, teamId, userId);
    const path = req.path || '/';
    let data;
    if (path === '/health') data = { status: 'ok', architecture: 'appwrite-native' };
    else if (path === '/content/generate') data = await generateContent(services, teamId, body);
    else if (path === '/content/generate-all') {
      const types = [
        'product_title',
        'listing',
        'faq',
        'tiktok_script',
        'instagram',
        'facebook_ad',
        'email_marketing',
        'seo_blog',
        'customer_service',
        'landing_page',
        'multilingual',
        'brand_voice',
      ];
      data = [];
      for (const type of types)
        data.push(await generateContent(services, teamId, { ...body, type }));
    } else if (path === '/kb/index') data = await indexDocument(services, teamId, body);
    else if (path === '/kb/ask') data = await askKnowledgeBase(services, teamId, body);
    else if (path === '/workflow/run') data = await runWorkflow(services, teamId, body);
    else if (path === '/crm/ai-reply') data = await crmReply(services, teamId, body);
    else throw new HttpError('函数路由不存在', 404, 'ROUTE_NOT_FOUND');
    return res.json({ data }, 200);
  } catch (caught) {
    logError?.(`${caught?.name || 'Error'}: ${caught?.message || 'Unknown error'}`);
    const status = Number(caught?.status || 500);
    const message =
      status >= 500 && !caught?.code ? '核心服务暂时不可用' : String(caught?.message || '请求失败');
    return res.json({ error: { code: caught?.code || 'INTERNAL_ERROR', message } }, status);
  }
};
