// 数据生成器：CRM 线索 + 客服对话 + 社媒内容 + 工作流日志（复合）
const { fakerEN_US: faker } = require('@faker-js/faker');

function genLead(i) {
  return {
    id: faker.string.uuid(),
    customer: { name: faker.person.fullName(), email: faker.internet.email(), phone: faker.phone.number() },
    source: faker.helpers.arrayElement(['shopify', 'instagram', 'tiktok', 'email_campaign', 'organic']),
    score: faker.number.int({ min: 0, max: 100 }),
    stage: faker.helpers.arrayElement(['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']),
    estimatedValue: parseFloat(faker.commerce.price({ min: 50, max: 5000 })),
    createdAt: faker.date.recent({ days: 90 }).toISOString(),
  };
}

function genConversation(i) {
  const msgs = faker.helpers.multiple(() => ({
    role: faker.helpers.arrayElement(['customer', 'agent', 'ai']),
    content: faker.lorem.sentences({ min: 1, max: 3 }),
    createdAt: faker.date.recent({ days: 30 }).toISOString(),
  }), { count: { min: 4, max: 10 } });
  return {
    id: faker.string.uuid(),
    channel: faker.helpers.arrayElement(['email', 'webchat', 'instagram', 'tiktok', 'whatsapp']),
    status: faker.helpers.arrayElement(['open', 'pending', 'closed']),
    customer: { name: faker.person.fullName(), email: faker.internet.email() },
    messages: msgs,
    summary: faker.lorem.sentence(),
  };
}

function genSocial(i) {
  return {
    id: faker.string.uuid(),
    platform: faker.helpers.arrayElement(['instagram', 'tiktok', 'facebook', 'twitter', 'linkedin']),
    type: faker.helpers.arrayElement(['caption', 'script', 'ad', 'post']),
    content: faker.lorem.paragraphs({ min: 1, max: 3 }),
    language: faker.helpers.arrayElement(['en', 'zh', 'es', 'ja']),
    engagement: { likes: faker.number.int({ max: 10000 }), comments: faker.number.int({ max: 500 }), shares: faker.number.int({ max: 1000 }) },
    createdAt: faker.date.recent({ days: 30 }).toISOString(),
  };
}

function genWorkflowLog(i) {
  return {
    runId: faker.string.uuid(),
    workflowName: faker.helpers.arrayElement(['Auto Content Pipeline', 'Lead Scoring Flow', 'Customer Support Bot', 'SEO Blog Generator']),
    status: faker.helpers.arrayElement(['SUCCESS', 'FAILED', 'RUNNING']),
    nodes: faker.number.int({ min: 3, max: 15 }),
    durationMs: faker.number.int({ min: 500, max: 60000 }),
    tokensUsed: faker.number.int({ min: 100, max: 50000 }),
    costUsd: faker.number.float({ min: 0.001, max: 0.5, multipleOf: 0.001 }),
    startedAt: faker.date.recent({ days: 7 }).toISOString(),
  };
}

const type = process.argv[2] || 'leads';
const count = parseInt(process.argv[3] || '100');
const gens = { leads: genLead, conversations: genConversation, social: genSocial, workflows: genWorkflowLog };
const gen = gens[type];
if (!gen) { console.error('Unknown type. Use: leads | conversations | social | workflows'); process.exit(1); }
for (let i = 0; i < count; i++) console.log(JSON.stringify(gen(i)));
