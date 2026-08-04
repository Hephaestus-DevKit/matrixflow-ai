// 把 packages/db/src/generated/client 整目录复制到 packages/db/dist/generated/client
// Prisma client 生成的全是 .js/.d.ts/.node 二进制，tsc 默认不复制 .js，所以单独 copy。
const fs = require('fs');
const path = require('path');
const R = path.resolve(__dirname, '..');
const src = path.join(R, 'packages', 'db', 'src', 'generated', 'client');
const dst = path.join(R, 'packages', 'db', 'dist', 'generated', 'client');

if (!fs.existsSync(src)) {
  console.error('copy-generated: src not found ' + src);
  process.exit(1);
}
fs.mkdirSync(dst, { recursive: true });

function copyDir(s, d) {
  for (const e of fs.readdirSync(s)) {
    const sp = path.join(s, e),
      dp = path.join(d, e);
    const st = fs.lstatSync(sp);
    if (st.isDirectory()) {
      fs.mkdirSync(dp, { recursive: true });
      copyDir(sp, dp);
    } else fs.copyFileSync(sp, dp);
  }
}
copyDir(src, dst);
console.log('copy-generated: OK (' + fs.readdirSync(dst).length + ' entries)');
