// 数据生成器 · 客服对话
import { faker } from '@faker-js/faker';
const COUNT = Number(process.argv[2] ?? 50);

function gen() {
  const msgs = [];
  let t = faker.date.recent({ days: 30 });
  for (let i = 0; i < faker.number.int({ min: 3, max: 8 }); i++) {
    t = new Date(t.getTime() + faker.number.int({ min: 1, max: 60 }) * 60000);
    msgs.push({ id: faker.string.uuid(), role: i % 2 === 0 ? 'customer' : 'agent', content: faker.lorem.sentence({ min: 5, max: 20 }), createdAt: t.toISOString() });
  }
  return { id: faker.string.uuid(), channel: faker.helpers.arrayElement(['email', 'webchat', 'instagram', 'tiktok']), status: faker.helpers.arrayElement(['open', 'pending', 'closed']), messages: msgs };
}
console.log(JSON.stringify(Array.from({ length: COUNT }, gen), null, 2));
