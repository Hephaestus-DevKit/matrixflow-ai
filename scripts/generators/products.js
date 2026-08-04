// 数据生成器：跨境电商商品测试数据
// 用法：node scripts/generators/products.js 100 > data/products.jsonl
const faker = require('@faker-js/faker').fakerEN;

const PLATFORMS = ['amazon', 'shopify', 'tiktok_shop', 'independent'];
const CATEGORIES = [
  'Electronics',
  'Home & Kitchen',
  'Beauty',
  'Fitness',
  'Pet',
  'Baby',
  'Outdoor',
  'Office',
  'Toys',
  'Auto',
];

function genProduct(i) {
  const cat = faker.helpers.arrayElement(CATEGORIES);
  const adjective = faker.commerce.productAdjective();
  const material = faker.commerce.productMaterial();
  const name = `${adjective} ${material} ${cat} Item ${i}`;
  return {
    id: faker.string.uuid(),
    name,
    slug: faker.helpers.slugify(name).toLowerCase(),
    description: faker.commerce.productDescription(),
    features: faker.helpers.multiple(() => faker.commerce.productDescription().slice(0, 60), {
      count: { min: 3, max: 6 },
    }),
    price: parseFloat(faker.commerce.price({ min: 9.99, max: 499.99 })),
    currency: 'USD',
    category: cat,
    platform: faker.helpers.arrayElement(PLATFORMS),
    sku: `SKU-${faker.string.alphanumeric(8).toUpperCase()}`,
    images: faker.helpers.multiple(() => faker.image.url(), { count: { min: 3, max: 5 } }),
    rating: faker.number.float({ min: 3.5, max: 5, multipleOf: 0.1 }),
    reviews: faker.number.int({ min: 0, max: 5000 }),
    stock: faker.number.int({ min: 0, max: 1000 }),
    brand: faker.company.name(),
    createdAt: faker.date.past().toISOString(),
  };
}

const count = parseInt(process.argv[2] || '100');
for (let i = 0; i < count; i++) {
  console.log(JSON.stringify(genProduct(i)));
}
