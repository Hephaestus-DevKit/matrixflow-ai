import { createHash, randomUUID } from 'node:crypto';
import {
  HttpError,
  enforceRequestRateLimit,
  requestBody,
  requireTeamMember,
  serverClient,
} from './runtime.js';
import { executeJob, verifyWorkerRequest } from './jobs.js';
import { resolveApiKey } from './api-keys.js';
import { handleBillingWebhook, handleStripeWebhook } from './billing-events.js';
import { claimIdempotency, completeIdempotency, releaseIdempotency } from './idempotency.js';
import { canonicalJson, HttpResult } from './http.js';

const DEFAULT_DEPENDENCIES = {
  claimIdempotency,
  completeIdempotency,
  enforceRequestRateLimit,
  executeJob,
  handleBillingWebhook,
  handleStripeWebhook,
  releaseIdempotency,
  requestBody,
  requireTeamMember,
  resolveApiKey,
  serverClient,
  verifyWorkerRequest,
};

const API_VERSION = '2026-08-16';
const SUPPORTED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const IDEMPOTENT_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function singleHeader(headers, name) {
  const value = headers?.[name];
  return typeof value === 'string' ? value.trim() : '';
}

function bearerToken(headers) {
  const authorization = singleHeader(headers, 'authorization');
  const matched = authorization.match(/^Bearer\s+(.+)$/i);
  return matched?.[1]?.trim() || '';
}

function assertJsonContentType(req, method) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return;
  const contentType = singleHeader(req.headers, 'content-type');
  // Appwrite may omit the header when it has already parsed bodyJson. Keep
  // that compatibility path, but reject an explicitly non-JSON payload
  // before any tenant or business work starts.
  if (
    contentType &&
    !/^(?:application\/json|application\/[^;]+\+json)(?:\s*;|$)/i.test(contentType)
  )
    throw new HttpError('请求内容类型必须是 JSON', 415, 'UNSUPPORTED_MEDIA_TYPE');
}

function safeStatus(caught) {
  const numericCode = Number(caught?.code);
  const candidate = Number(
    caught?.status || (numericCode >= 400 && numericCode < 600 ? numericCode : 500),
  );
  return Number.isInteger(candidate) && candidate >= 400 && candidate < 600 ? candidate : 500;
}

function errorCodeFor(caught, status) {
  if (typeof caught?.code === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(caught.code))
    return caught.code;
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 429) return 'RATE_LIMITED';
  return 'INTERNAL_ERROR';
}

export function createRequestHandler({ handleRoute, readinessSnapshot, dependencies = {} }) {
  const deps = { ...DEFAULT_DEPENDENCIES, ...dependencies };

  return async ({ req, res, log, error: logError }) => {
    const rawRequestId = singleHeader(req.headers, 'x-appwrite-execution-id');
    const requestId = /^[A-Za-z0-9._:-]{1,128}$/.test(rawRequestId) ? rawRequestId : randomUUID();
    const path = typeof req.path === 'string' && req.path.length <= 512 ? req.path : '/';
    const method = String(req.method || 'POST').toUpperCase();
    const startedAt = Date.now();
    let services;
    let idempotencyClaim;
    let idempotencyTeamId;
    let requestLogContext = {
      method,
      path,
      release: process.env.MATRIXFLOW_RELEASE || 'production',
    };

    try {
      if (!SUPPORTED_METHODS.has(method))
        throw new HttpError('不支持的请求方法', 405, 'METHOD_NOT_ALLOWED');

      assertJsonContentType(req, method);

      if (path === '/healthz' && method === 'GET')
        return res.json(
          {
            status: 'ok',
            service: 'matrixflow-core',
            timestamp: new Date().toISOString(),
          },
          200,
        );

      if (path === '/readyz' && method === 'GET') {
        const readiness = readinessSnapshot();
        return res.json(
          {
            status: readiness.status,
            service: 'matrixflow-core',
            checks: readiness.checks,
            timestamp: new Date().toISOString(),
          },
          readiness.ready ? 200 : 503,
        );
      }

      if (path === '/internal/jobs/execute' && method === 'POST') {
        deps.verifyWorkerRequest(req.headers);
        const workerBody = deps.requestBody(req);
        services = deps.serverClient(req);
        const result = await deps.executeJob(services, {
          jobId: workerBody.jobId,
          organizationId: workerBody.organizationId,
          requestId,
        });
        return res.json({ data: result, meta: { requestId, apiVersion: API_VERSION } }, 200);
      }

      if (path === '/billing/webhook' && method === 'POST')
        return await deps.handleBillingWebhook({ req, res });
      if (path === '/billing/stripe-webhook' && method === 'POST')
        return await deps.handleStripeWebhook({ req, res });

      const body = deps.requestBody(req);
      const headerTeamId = singleHeader(req.headers, 'x-matrixflow-organization');
      const bodyTeamId = typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
      if (headerTeamId && bodyTeamId && headerTeamId !== bodyTeamId)
        throw new HttpError('请求头与请求体中的组织不一致', 400, 'ORGANIZATION_MISMATCH');
      const teamId = bodyTeamId || headerTeamId;
      if (!teamId) throw new HttpError('请求必须提供组织 ID', 400, 'ORGANIZATION_REQUIRED');
      idempotencyTeamId = teamId;

      const payload = { ...body };
      delete payload.organizationId;
      const bodyIdempotencyKey = payload.__idempotencyKey;
      delete payload.__idempotencyKey;
      const headerIdempotencyKey = singleHeader(req.headers, 'idempotency-key');
      if (
        headerIdempotencyKey &&
        bodyIdempotencyKey !== undefined &&
        headerIdempotencyKey !== bodyIdempotencyKey
      )
        throw new HttpError('请求头与请求体中的幂等键不一致', 400, 'IDEMPOTENCY_KEY_MISMATCH');
      const idempotencyKey = headerIdempotencyKey || bodyIdempotencyKey;
      if (
        IDEMPOTENT_METHODS.has(method) &&
        idempotencyKey !== undefined &&
        (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey))
      )
        throw new HttpError('幂等键格式无效', 400, 'INVALID_IDEMPOTENCY_KEY');

      services = deps.serverClient(req);
      const rawApiKey =
        singleHeader(req.headers, 'x-matrixflow-api-key') || bearerToken(req.headers);
      let userId = singleHeader(req.headers, 'x-appwrite-user-id');
      let membership;
      if (rawApiKey) {
        membership = await deps.resolveApiKey(services, teamId, rawApiKey);
        userId = membership.userId;
      } else {
        if (!userId) throw new HttpError('请先登录', 401, 'UNAUTHENTICATED');
        membership = await deps.requireTeamMember(services, teamId, userId);
      }

      const context = { teamId, userId, requestId };
      requestLogContext = {
        ...requestLogContext,
        organizationHash: createHash('sha256').update(teamId, 'utf8').digest('hex').slice(0, 12),
        authSource: membership.source === 'api-key' ? 'api-key' : 'appwrite-session',
      };
      await deps.enforceRequestRateLimit(
        services,
        teamId,
        membership.source === 'api-key' ? `api-key:${membership.apiKeyId}` : `user:${userId}`,
      );

      const fingerprint = idempotencyKey
        ? createHash('sha256').update(canonicalJson({ method, path, payload })).digest('hex')
        : null;
      if (idempotencyKey && fingerprint) {
        const claimed = await deps.claimIdempotency(services, teamId, {
          key: idempotencyKey,
          fingerprint,
          method,
          path,
        });
        if (claimed.replay) {
          log?.(
            JSON.stringify({
              requestId,
              ...requestLogContext,
              status: claimed.status || 200,
              durationMs: Date.now() - startedAt,
              idempotencyReplay: true,
            }),
          );
          return res.json(claimed.replay, claimed.status || 200);
        }
        idempotencyClaim = claimed.claim;
        context.idempotencyId = idempotencyClaim.id;
      }

      const routed = await handleRoute({
        services,
        context,
        membership,
        path,
        method,
        body: payload,
      });
      const data = routed instanceof HttpResult ? routed.data : routed;
      const responseStatus = routed instanceof HttpResult ? routed.status : 200;
      const response = { data, meta: { requestId, apiVersion: API_VERSION } };
      if (idempotencyKey && fingerprint && idempotencyClaim) {
        try {
          const stored = await deps.completeIdempotency(
            services,
            teamId,
            idempotencyClaim.id,
            response,
            responseStatus,
          );
          if (stored) idempotencyClaim.completed = true;
          else idempotencyClaim = undefined;
        } catch (error) {
          idempotencyClaim.uncertain = true;
          throw error;
        }
      }
      log?.(
        JSON.stringify({
          requestId,
          ...requestLogContext,
          status: responseStatus,
          durationMs: Date.now() - startedAt,
        }),
      );
      return res.json(response, responseStatus);
    } catch (caught) {
      if (
        services &&
        idempotencyClaim &&
        idempotencyTeamId &&
        !idempotencyClaim.completed &&
        !idempotencyClaim.uncertain
      )
        await deps
          .releaseIdempotency(services, idempotencyTeamId, idempotencyClaim.id)
          .catch(() => undefined);

      const status = safeStatus(caught);
      const expectedError = caught instanceof HttpError || caught?.name === 'ProviderError';
      const errorCode = errorCodeFor(caught, status);
      logError?.(
        JSON.stringify({
          requestId,
          ...requestLogContext,
          status,
          code: errorCode,
          durationMs: Date.now() - startedAt,
        }),
      );
      const message = expectedError
        ? String(caught?.message || '请求失败')
        : status === 401
          ? '请重新登录后重试'
          : status === 403
            ? '无权访问该团队资源'
            : status === 404
              ? '请求的资源不存在'
              : status === 429
                ? '请求过于频繁，请稍后重试'
                : '核心服务暂时不可用';
      return res.json(
        {
          error: {
            code: errorCode,
            message,
            details: expectedError ? caught?.details : undefined,
            requestId,
          },
        },
        status,
      );
    }
  };
}
