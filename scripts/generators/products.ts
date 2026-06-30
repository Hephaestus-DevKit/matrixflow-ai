// 数据生成器 · 商品测试数据（Faker）
// 用法: pnpm --filter @matrixflow/db tsx scripts/generators/products.ts 100
import { faker } from '@faker-js/faker';

const COUNT = Number(process.argv[2] ?? 100);

const PLATFORMS = ['amazon', 'shopify', 'tiktok_shop', '独立站'];
const CATEGORIES = ['3C', '家居', '美妆', '服饰', '宠物', '母婴', '户外', '食品'];

function gen() {
  const name = faker.commerce.productName();
  return {
    id: faker.string.uuid(),
    title: name,
    description: faker.commerce.productDescription(),
    features: Array.from({ length: 3 }, () => faker.commerce.productAdjective() + ' ' + faker.commerce.productMaterial()),
    specs: { weight: faker.number.float({ min: 0.1, max: 5 }) + 'kg', dimensions: `${faker.number.int({ min: 5, max: 50 })}x${faker.number.int({ min: 5, max: 50 })}x${faker.number.int({ min: 5, max: 50 })}cm` },
    images: Array.from({ length: 3 }, () => faker.image.url()),
    price: faker.number.float({ min: 9.99, max: 499.99 }),
    currency: 'USD',
    category: faker.helpers.arrayElement(CATEGORIES),
    brand: faker.company.name(),
    platform: faker.helpers.arrayElement(PLATFORMS),
    createdAt: faker.date.recent({ days: 90 }).toISOString(),
  };
}

const data = Array.from({ length: COUNT }, gen);
console.log(JSON.stringify(data, null, 2));
