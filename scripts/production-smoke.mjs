import { pathToFileURL } from 'node:url';

const ROUTES = [
  { path: '/', marker: '跨境电商专属 · AI 员工操作系统' },
  { path: '/login', marker: '欢迎回来', canonical: false },
  { path: '/register', marker: '创建你的 AI 团队', canonical: false },
  { path: '/pricing', marker: '从可验证的免费版本开始' },
  { path: '/privacy', marker: '隐私政策' },
  { path: '/terms', marker: '服务条款' },
];

function headerValue(headers, name) {
  if (typeof headers?.get === 'function') return headers.get(name) || '';
  const entry = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === name);
  return String(entry?.[1] || '');
}

export function validateProductionPage({ route, status, headers, body, canonicalOrigin }) {
  const failures = [];
  const prefix = route.path === '/' ? 'home' : route.path;
  if (status !== 200) {
    failures.push(`${route.path}: expected 200, received ${status}`);
    return failures;
  }

  const contentType = headerValue(headers, 'content-type').toLowerCase();
  if (!contentType.includes('text/html'))
    failures.push(`${route.path}: expected an HTML response, received ${contentType || '<empty>'}`);
  if (!body.includes('MatrixFlow'))
    failures.push(`${route.path}: MatrixFlow brand marker is missing`);
  if (!body.includes(route.marker))
    failures.push(`${route.path}: route-specific marker is missing (${route.marker})`);
  if (!/<html\b[^>]*\blang=["']zh-CN["']/i.test(body))
    failures.push(`${route.path}: default document language is not zh-CN`);

  if (route.canonical !== false) {
    const canonicalPath = route.path === '/' ? '' : route.path;
    const expectedCanonical = `${canonicalOrigin}${canonicalPath}`;
    const canonicalTags = body.match(/<link\b[^>]*>/gi) || [];
    const hasCanonical = canonicalTags.some(
      (tag) =>
        /\brel=["']canonical["']/i.test(tag) &&
        (tag.includes(`href="${expectedCanonical}"`) ||
          tag.includes(`href='${expectedCanonical}'`)),
    );
    if (!hasCanonical)
      failures.push(
        `${route.path}: canonical URL is missing or does not match ${expectedCanonical}`,
      );
  }

  const csp = headerValue(headers, 'content-security-policy');
  for (const directive of [
    "default-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ]) {
    if (!csp.includes(directive))
      failures.push(`${prefix}: content-security-policy is missing ${directive}`);
  }
  const hsts = headerValue(headers, 'strict-transport-security');
  const hstsAge = Number(/max-age=(\d+)/i.exec(hsts)?.[1] || 0);
  if (hstsAge < 31_536_000)
    failures.push(`${prefix}: strict-transport-security max-age is below one year`);

  const exactHeaders = {
    'x-frame-options': 'deny',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin',
  };
  for (const [name, expected] of Object.entries(exactHeaders)) {
    const actual = headerValue(headers, name).toLowerCase();
    if (actual !== expected)
      failures.push(`${prefix}: ${name} should be ${expected}, received ${actual || '<empty>'}`);
  }
  const permissions = headerValue(headers, 'permissions-policy').toLowerCase();
  for (const policy of ['camera=()', 'microphone=()', 'geolocation=()']) {
    if (!permissions.includes(policy))
      failures.push(`${prefix}: permissions-policy is missing ${policy}`);
  }
  if (headerValue(headers, 'x-powered-by'))
    failures.push(`${prefix}: x-powered-by should not disclose the framework`);

  return failures;
}

export async function runProductionSmoke({
  baseUrl = process.env.MATRIXFLOW_PRODUCTION_URL || 'https://matrixflow-ai.vercel.app',
  canonicalOrigin = process.env.MATRIXFLOW_CANONICAL_URL || 'https://matrixflow-ai.vercel.app',
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const normalizedCanonicalOrigin = canonicalOrigin.replace(/\/+$/, '');
  const failures = [];

  for (const route of ROUTES) {
    const url = `${normalizedBaseUrl}${route.path}`;
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'matrixflow-production-smoke/2.0' },
        redirect: 'manual',
      });
      const body = await response.text();
      failures.push(
        ...validateProductionPage({
          route,
          status: response.status,
          headers: response.headers,
          body,
          canonicalOrigin: normalizedCanonicalOrigin,
        }),
      );
      process.stdout.write(`ok ${route.path} (${response.status})\n`);
    } catch (error) {
      failures.push(`${route.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Production smoke failed for ${normalizedBaseUrl}\n${failures.map((item) => `- ${item}`).join('\n')}`,
    );
  }
  process.stdout.write(`Production smoke passed for ${normalizedBaseUrl}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) {
  runProductionSmoke().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
