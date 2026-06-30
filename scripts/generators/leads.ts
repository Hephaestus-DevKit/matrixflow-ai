// 数据生成器 · CRM 线索
import { faker } from '@faker-js/faker';
const COUNT = Number(process.argv[2] ?? 50);
const STAGES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];
const SOURCES = ['shopify', 'manual', 'import', 'webhook', 'instagram', 'tiktok'];

function gen() {
  return {
    id: faker.string.uuid(),
    customer: { name: faker.person.fullName(), email: faker.internet.email(), phone: faker.phone.number() },
    source: faker.helpers.arrayElement(SOURCES),
    score: faker.number.int({ min: 0, max: 100 }),
    stage: faker.helpers.arrayElement(STAGES),
    value: faker.number.float({ min: 50, max: 5000 }),
    createdAt: faker.date.recent({ days: 60 }).toISOString(),
  };
}
console.log(JSON.stringify(Array.from({ length: COUNT }, gen), null, 2));
