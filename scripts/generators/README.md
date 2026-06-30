// MatrixFlow AI · 数据生成器
// 用法：
//   node scripts/generators/products.js 100 > data/products.jsonl
//   node scripts/generators/crm.js leads 100 > data/leads.jsonl
//   node scripts/generators/crm.js conversations 50 > data/conversations.jsonl
//   node scripts/generators/crm.js social 50 > data/social.jsonl
//   node scripts/generators/crm.js workflows 50 > data/workflow-logs.jsonl
//
// 安装依赖：pnpm -w add -D @faker-js/faker
// 生成后可批量导入 DB（scripts/import.js [P1]）

# 约定
- 输出 JSON Lines (.jsonl)，每行一个独立 JSON 对象
- 字段与 Prisma schema 对齐，可直接映射入库
- 数量可参数化，默认 100 条
- 时间字段 ISO 8601 UTC
