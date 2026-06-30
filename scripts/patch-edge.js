// patch-edge.js — Patches the generated Prisma wasm.js to use a Node.js-compatible
// WASM loader instead of the edge-only '#wasm-engine-loader' import specifier.
// This is needed because wasm.js is designed for edge environments but we run on Node.js.

const fs = require('fs');
const path = require('path');
const R = path.resolve(__dirname, '..');

const clientDirs = [
  path.join(R, 'packages', 'db', 'dist', 'generated', 'client'),
  path.join(R, 'packages', 'db', 'src', 'generated', 'client'),
];

for (const clientDir of clientDirs) {
  const wasmPath = path.join(clientDir, 'wasm.js');
  if (!fs.existsSync(wasmPath)) {
    console.log(`patch-edge: skipping ${clientDir}/wasm.js (not found)`);
    continue;
  }

  let content = fs.readFileSync(wasmPath, 'utf8');
  let changed = false;

  // Replace edge-only '#wasm-engine-loader' import with Node.js fs-based WASM loading
  const original = `getQueryEngineWasmModule: async () => {
    const loader = (await import('#wasm-engine-loader')).default
    const engine = (await loader).default
    return engine
  }`;

  const replacement = `getQueryEngineWasmModule: async () => {
    const { readFileSync } = require('fs');
    const { join } = require('path');
    return WebAssembly.compile(readFileSync(join(__dirname, 'query_engine_bg.wasm')));
  }`;

  if (content.includes(original)) {
    content = content.replaceAll(original, replacement);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(wasmPath, content, 'utf8');
    console.log(`patch-edge: OK — patched ${clientDir}/wasm.js`);
  } else {
    console.log(`patch-edge: ${clientDir}/wasm.js already patched or pattern not found`);
  }
}
