import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pageText,
  runProductionSmoke,
  validateLocalePage,
  validateProductionPage,
} from './production-smoke.mjs';

const canonicalOrigin = 'https://matrixflow-ai.vercel.app';
const route = { path: '/pricing', marker: '从可验证的免费版本开始' };
const secureHeaders = {
  'content-type': 'text/html; charset=utf-8',
  'content-security-policy':
    "default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

test('accepts a route-specific localized page with the full security baseline', () => {
  const failures = validateProductionPage({
    route,
    status: 200,
    headers: secureHeaders,
    body: `<html lang="zh-CN"><head><link rel="canonical" href="${canonicalOrigin}/pricing" /></head><body>MatrixFlow 从可验证的免费版本开始</body></html>`,
    canonicalOrigin,
  });
  assert.deepEqual(failures, []);
});

test('rejects a branded shell when route content and security controls are missing', () => {
  const failures = validateProductionPage({
    route,
    status: 200,
    headers: { 'content-type': 'text/html' },
    body: '<html lang="en"><body>MatrixFlow</body></html>',
    canonicalOrigin,
  });
  assert.ok(failures.some((failure) => failure.includes('route-specific marker')));
  assert.ok(failures.some((failure) => failure.includes('default document language')));
  assert.ok(failures.some((failure) => failure.includes('canonical URL')));
  assert.ok(failures.some((failure) => failure.includes('strict-transport-security')));
  assert.ok(failures.some((failure) => failure.includes('permissions-policy')));
});

test('fails fast on redirects or non-success responses', () => {
  assert.deepEqual(
    validateProductionPage({ route, status: 307, headers: {}, body: '', canonicalOrigin }),
    ['/pricing: expected 200, received 307'],
  );
});

test('requires the selected locale in server-rendered content and metadata', () => {
  assert.deepEqual(
    validateLocalePage({
      locale: 'en',
      marker: 'Built for cross-border commerce · AI workforce OS',
      title: 'MatrixFlow AI — AI Workforce OS',
      status: 200,
      body: '<html lang="en"><head><title>MatrixFlow AI — AI Workforce OS</title></head><body>Built for cross-border commerce · AI workforce OS</body></html>',
    }),
    [],
  );

  const failures = validateLocalePage({
    locale: 'zh-TW',
    marker: '跨境電商專屬 · AI 員工作業系統',
    title: 'MatrixFlow AI — AI 員工作業系統',
    status: 200,
    body: '<html lang="zh-CN"><head><title>MatrixFlow AI</title></head><body>MatrixFlow</body></html>',
  });
  assert.ok(failures.some((failure) => failure.includes('document language')));
  assert.ok(failures.some((failure) => failure.includes('content marker')));
  assert.ok(failures.some((failure) => failure.includes('localized title')));
});

test('localized text in hydration scripts cannot disguise a missing page body', () => {
  const marker = 'AI workforce for cross-border commerce';
  const failures = validateLocalePage({
    locale: 'en',
    marker,
    title: 'MatrixFlow AI',
    status: 200,
    body: `<html lang="en"><head><title>MatrixFlow AI</title></head><body><script>const dictionary = "${marker}";</script><p>Loading</p></body></html>`,
  });
  assert.ok(failures.some((failure) => failure.includes('content marker')));
});

for (const markup of [
  '<script>hidden marker<script>nested</script>',
  '<!-- hidden marker <!-- nested -->',
  '<head><title>hidden marker</title></head><style>hidden marker</style>',
]) {
  test(`HTML extraction excludes inactive content: ${markup.slice(0, 25)}`, () => {
    assert.equal(pageText(markup).trim(), '');
    assert.match(pageText('<main>Visible &amp; confirmed</main>'), /Visible & confirmed/);
  });
}

const productionOrigin = 'https://matrixflow-ai-sycamore-tree.vercel.app';
const liveRouteMarkers = {
  '/': '跨境电商 AI 员工操作系统',
  '/login': '欢迎回来',
  '/register': '创建你的 AI 团队',
  '/pricing': '从可验证的免费版本开始',
  '/privacy': '隐私政策',
  '/terms': '服务条款',
};
const liveLocalePages = {
  'zh-CN': ['跨境电商 AI 员工操作系统', 'MatrixFlow AI — AI 员工操作系统'],
  'zh-TW': ['跨境電商 AI 員工作業系統', 'MatrixFlow AI — AI 員工作業系統'],
  en: ['AI workforce for cross-border commerce', 'MatrixFlow AI — AI Workforce OS'],
};

function livePageFixture(url, options) {
  const path = new URL(url).pathname;
  const locale = options.headers.cookie?.split('=')[1] || 'zh-CN';
  const [homeMarker, title] = liveLocalePages[locale];
  const marker = path === '/' ? homeMarker : liveRouteMarkers[path];
  return new Response(
    `<html lang="${locale}"><head><title>${title}</title><link rel="canonical" href="${productionOrigin}${path === '/' ? '' : path}" /></head><body>MatrixFlow ${marker}</body></html>`,
    { status: 200, headers: secureHeaders },
  );
}

test('checks all six production routes and three locales with the current home copy', async () => {
  const requests = [];
  await runProductionSmoke({
    baseUrl: productionOrigin,
    canonicalOrigin: productionOrigin,
    fetchPage: async (url, options) => {
      requests.push({ url, locale: options.headers.cookie, redirect: options.redirect });
      return livePageFixture(url, options);
    },
  });
  assert.equal(requests.length, 9);
  assert.deepEqual(
    requests.slice(0, 6).map(({ url }) => new URL(url).pathname),
    Object.keys(liveRouteMarkers),
  );
  assert.deepEqual(
    requests.slice(6).map(({ locale }) => locale),
    ['matrixflow-locale=zh-CN', 'matrixflow-locale=zh-TW', 'matrixflow-locale=en'],
  );
  assert.ok(requests.every(({ redirect }) => redirect === 'manual'));
});

test('a 200 response with missing English page content still fails the full smoke', async () => {
  await assert.rejects(
    runProductionSmoke({
      baseUrl: productionOrigin,
      canonicalOrigin: productionOrigin,
      fetchPage: async (url, options) => {
        if (options.headers.cookie === 'matrixflow-locale=en')
          return new Response(
            '<html lang="en"><head><title>MatrixFlow AI — AI Workforce OS</title></head><body>MatrixFlow Loading</body></html>',
            { status: 200, headers: secureHeaders },
          );
        return livePageFixture(url, options);
      },
    }),
    /locale en: server-rendered localized content marker is missing/,
  );
});
