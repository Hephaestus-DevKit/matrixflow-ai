import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionPage } from './production-smoke.mjs';

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
