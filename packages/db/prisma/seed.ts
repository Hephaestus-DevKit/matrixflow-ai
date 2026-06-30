import { PrismaClient, PlanTier, AgentStatus, RunStatus } from '../src/generated/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding MatrixFlow AI...');

  // ---- Plans ----
  const plans = [
    { tier: PlanTier.FREE, name: 'Free', priceMonthlyUsd: 0, priceYearlyUsd: 0, seats: 1, aiCallsPerMonth: 100, workflowLimit: 1, kbLimit: 1, kbDocLimit: 50, features: { marketplace: 'buy' } },
    { tier: PlanTier.STARTER, name: 'Starter', priceMonthlyUsd: 29, priceYearlyUsd: 290, seats: 3, aiCallsPerMonth: 1000, workflowLimit: 5, kbLimit: 3, kbDocLimit: 500, features: { marketplace: 'both' } },
    { tier: PlanTier.PRO, name: 'Pro', priceMonthlyUsd: 99, priceYearlyUsd: 990, seats: 10, aiCallsPerMonth: 5000, workflowLimit: 20, kbLimit: 10, kbDocLimit: 5000, features: { marketplace: 'both', brandVoice: true } },
    { tier: PlanTier.BUSINESS, name: 'Business', priceMonthlyUsd: 299, priceYearlyUsd: 2990, seats: 30, aiCallsPerMonth: 20000, workflowLimit: -1, kbLimit: 50, kbDocLimit: -1, features: { marketplace: 'both', payout: true } },
    { tier: PlanTier.ENTERPRISE, name: 'Enterprise', priceMonthlyUsd: 0, priceYearlyUsd: 0, seats: -1, aiCallsPerMonth: -1, workflowLimit: -1, kbLimit: -1, kbDocLimit: -1, features: { marketplace: 'custom', sso: true, privateDeploy: true } },
  ];
  for (const p of plans) {
    await prisma.plan.upsert({ where: { tier: p.tier }, update: p, create: p });
  }
  console.log(`  ✓ ${plans.length} plans`);

  // ---- Model Costs (GLM 价目) ----
  const costs = [
    { provider: 'glm', model: 'glm-4-plus', inputPer1kUsd: 0.005, outputPer1kUsd: 0.015, effectiveFrom: new Date('2026-01-01') },
    { provider: 'glm', model: 'glm-4-air', inputPer1kUsd: 0.001, outputPer1kUsd: 0.002, effectiveFrom: new Date('2026-01-01') },
    { provider: 'glm', model: 'embedding-3', inputPer1kUsd: 0.0005, outputPer1kUsd: 0, effectiveFrom: new Date('2026-01-01') },
    { provider: 'openai', model: 'gpt-4o-mini', inputPer1kUsd: 0.00015, outputPer1kUsd: 0.0006, effectiveFrom: new Date('2026-01-01') },
    { provider: 'openai', model: 'text-embedding-3-small', inputPer1kUsd: 0.00002, outputPer1kUsd: 0, effectiveFrom: new Date('2026-01-01') },
    { provider: 'anthropic', model: 'claude-3-5-sonnet-latest', inputPer1kUsd: 0.003, outputPer1kUsd: 0.015, effectiveFrom: new Date('2026-01-01') },
    { provider: 'gemini', model: 'gemini-1.5-flash', inputPer1kUsd: 0.000075, outputPer1kUsd: 0.0003, effectiveFrom: new Date('2026-01-01') },
  ];
  for (const c of costs) {
    await prisma.modelCost.upsert({
      where: { provider_model_effectiveFrom: { provider: c.provider, model: c.model, effectiveFrom: c.effectiveFrom } },
      update: c, create: c,
    });
  }
  console.log(`  ✓ ${costs.length} model costs`);

  // ---- Prompt Templates (跨境电商 MVP 核心) ----
  const prompts = [
    {
      key: 'product_title',
      name: '商品标题生成',
      category: 'ecommerce',
      systemPrompt: '你是跨境电商资深文案专家，擅长写出符合平台 SEO 规则且高转化的商品标题。严格遵守平台字数与禁用词规则。',
      userPromptTemplate: '商品资料：{{productJson}}\n目标平台：{{platform}}\n目标语言：{{language}}\n请生成 5 个商品标题，每个 ≤ {{maxLength}} 字。输出 JSON 数组。',
      inputSchema: { type: 'object', properties: { productJson: { type: 'object' }, platform: { type: 'string' }, language: { type: 'string' }, maxLength: { type: 'number' } }, required: ['productJson', 'platform', 'language'] },
      outputSchema: { type: 'array', items: { type: 'string' } },
      tags: ['ecommerce', 'amazon', 'shopify'],
    },
    {
      key: 'tiktok_script',
      name: 'TikTok 短视频脚本',
      category: 'social',
      systemPrompt: '你是 TikTok 爆款脚本编剧，遵循"前 3 秒钩子 + 痛点 + 解决方案 + CTA"结构。',
      userPromptTemplate: '商品：{{productJson}}\n目标受众：{{audience}}\n时长：{{duration}}秒\n语言：{{language}}\n输出 JSON：{hook, scenes:[{second, voiceover, action, text}], cta}',
      inputSchema: { type: 'object', properties: { productJson: { type: 'object' }, audience: { type: 'string' }, duration: { type: 'number' }, language: { type: 'string' } }, required: ['productJson', 'audience', 'duration'] },
      outputSchema: { type: 'object', properties: { hook: { type: 'string' }, scenes: { type: 'array' }, cta: { type: 'string' } } },
      tags: ['tiktok', 'video'],
    },
    {
      key: 'rag_qa',
      name: 'RAG 问答',
      category: 'rag',
      systemPrompt: '你是知识库问答助手。只依据提供的上下文回答，若上下文无答案请明说"未在知识库中找到"。引用来源编号 [docN]。',
      userPromptTemplate: '上下文：\n{{context}}\n\n问题：{{question}}\n\n输出 JSON：{answer, citations:[{docId, snippet}]}',
      inputSchema: { type: 'object', properties: { context: { type: 'string' }, question: { type: 'string' } }, required: ['context', 'question'] },
      outputSchema: { type: 'object', properties: { answer: { type: 'string' }, citations: { type: 'array' } } },
      tags: ['rag', 'qa'],
    },
  ];
  for (const p of prompts) {
    await prisma.promptTemplate.upsert({ where: { key: p.key }, update: p, create: { ...p, version: 1, isLatest: true } });
  }
  console.log(`  ✓ ${prompts.length} prompt templates`);

  // ---- Agent Templates ----
  const agentTemplates = [
    { name: '跨境文案专员', role: 'copywriter', description: '专为跨境电商生成多平台商品文案', systemPrompt: { templateKey: 'product_title', variables: {} }, defaultSkills: ['content:product_title', 'content:listing'], defaultTools: [], category: 'ecommerce', tags: ['amazon', 'shopify'] },
    { name: 'TikTok 内容官', role: 'content_creator', description: '生成 TikTok 爆款脚本与文案', systemPrompt: { templateKey: 'tiktok_script', variables: {} }, defaultSkills: ['content:tiktok_script'], defaultTools: [], category: 'social', tags: ['tiktok'] },
    { name: '知识库客服', role: 'customer_service', description: '基于知识库的 RAG 客服', systemPrompt: { templateKey: 'rag_qa', variables: {} }, defaultSkills: ['rag:qa'], defaultTools: ['query_kb'], category: 'support', tags: ['support', 'rag'] },
  ];
  for (const t of agentTemplates) {
    const exists = await prisma.agentTemplate.findFirst({ where: { name: t.name } });
    if (!exists) await prisma.agentTemplate.create({ data: { ...t, isPublished: true } });
  }
  console.log(`  ✓ ${agentTemplates.length} agent templates`);

  console.log('✅ Seed done.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
