import {
  HttpError,
  TABLES,
  createRow,
  deleteOwned,
  getOwned,
  recordAudit,
  requireCapability,
  releasePlanResourceLimit,
  reservePlanResourceLimit,
  updateOwned,
} from '../runtime.js';
import { deleteAgent, runAgent } from '../features.js';
import { parse, schemas } from '../schemas.js';
import { enqueueJob } from '../jobs.js';
import { HttpResult } from '../http.js';

const TEMPLATES = Object.freeze({
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
});

async function enforceAgentLimit(services, teamId) {
  return reservePlanResourceLimit(services, teamId, 'agentLimit', 10, 'AI 员工');
}

export async function handleAgentRoute({
  services,
  context,
  membership,
  segments,
  method,
  body,
  ai,
}) {
  if (method === 'POST' && segments.length === 1) {
    requireCapability(membership, 'agents.manage');
    const input = parse(schemas.agentCreate, body);
    const reservation = await enforceAgentLimit(services, context.teamId);
    let agent;
    try {
      agent = await createRow(services, TABLES.agents, context.teamId, {
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
    } catch (error) {
      if (agent) {
        try {
          await deleteOwned(services, TABLES.agents, agent.id, context.teamId);
          await releasePlanResourceLimit(services, context.teamId, reservation);
        } catch {
          // Keep the reservation when compensation is incomplete so capacity
          // cannot be oversold; reconciliation can safely repair it later.
        }
      } else
        await releasePlanResourceLimit(services, context.teamId, reservation).catch(
          () => undefined,
        );
      throw error;
    }
  }

  if (method === 'POST' && segments.length === 3 && segments[1] === 'from-template') {
    requireCapability(membership, 'agents.manage');
    const template = TEMPLATES[segments[2]];
    if (!template) throw new HttpError('模板不存在', 404, 'TEMPLATE_NOT_FOUND');
    const input = parse(schemas.agentCreate.pick({ name: true }), body);
    const reservation = await enforceAgentLimit(services, context.teamId);
    let agent;
    try {
      agent = await createRow(services, TABLES.agents, context.teamId, {
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
    } catch (error) {
      if (agent) {
        try {
          await deleteOwned(services, TABLES.agents, agent.id, context.teamId);
          await releasePlanResourceLimit(services, context.teamId, reservation);
        } catch {
          // Keep the reservation when compensation is incomplete.
        }
      } else
        await releasePlanResourceLimit(services, context.teamId, reservation).catch(
          () => undefined,
        );
      throw error;
    }
  }

  if ((method === 'PATCH' || method === 'PUT') && segments.length === 2 && segments[1]) {
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

  if (method === 'DELETE' && segments.length === 2 && segments[1]) {
    requireCapability(membership, 'agents.manage');
    const deleted = await deleteAgent(services, context, segments[1]);
    await releasePlanResourceLimit(services, context.teamId, {
      bucket: 'resource:agentLimit',
    }).catch(() => undefined);
    return deleted;
  }

  if (method === 'POST' && segments.length === 3 && segments[1] && segments[2] === 'run') {
    requireCapability(membership, 'agents.manage');
    const input = parse(schemas.agentRun, body);
    await getOwned(services, TABLES.agents, segments[1], context.teamId);
    if (input.mode === 'async')
      return new HttpResult(
        await enqueueJob(services, context, 'agent.run', {
          agentId: segments[1],
          input: input.input,
          retryOf: input.retryOf,
          retryCount: input.retryCount,
        }),
        202,
      );
    return runAgent(services, context, {
      agentId: segments[1],
      ...input,
    });
  }

  if (
    method === 'POST' &&
    segments.length === 5 &&
    segments[1] &&
    segments[2] === 'runs' &&
    segments[3] &&
    segments[4] === 'retry'
  ) {
    requireCapability(membership, 'agents.manage');
    const previous = await getOwned(services, TABLES.agentRuns, segments[3], context.teamId);
    if (previous.agentId !== segments[1])
      throw new HttpError('运行记录不属于该 AI 员工', 403, 'FORBIDDEN');
    if (!['FAILED', 'COMPLETED'].includes(previous.status))
      throw new HttpError('当前运行状态不可重试', 409, 'RUN_NOT_RETRYABLE');
    return runAgent(services, context, {
      agentId: segments[1],
      input: previous.input || {},
      retryOf: previous.id,
      retryCount: Math.min(10, Number(previous.retryCount || 0) + 1),
    });
  }

  throw new HttpError('函数路由不存在', 404, 'ROUTE_NOT_FOUND');
}
