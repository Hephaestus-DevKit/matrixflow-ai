# 测试数据生成器

这些脚本只用于生成本地测试数据，不参与生产启动或数据库 seed。输出采用 JSON Lines，每行一个对象。

```bash
node scripts/generators/products.js 100 > data/products.jsonl
node scripts/generators/crm.js leads 100 > data/leads.jsonl
node scripts/generators/crm.js conversations 50 > data/conversations.jsonl
node scripts/generators/crm.js social 50 > data/social.jsonl
node scripts/generators/crm.js workflows 50 > data/workflow-logs.jsonl
```

`agent-templates.ts` 与 `industry-solutions.ts` 是产品模板源数据，不是命令行生成器。正式数据库初始化以 `packages/db/prisma/seed.ts` 为准。
