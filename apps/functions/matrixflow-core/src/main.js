import { HttpError, requireAdmin } from './runtime.js';
import { routeParts } from './http.js';
import { createRequestHandler } from './request-handler.js';
import { providerReadiness, readinessSnapshot } from './readiness.js';
import { handleSystemRoute } from './routes/system.js';
import { handleBillingRoute } from './routes/billing.js';
import { handleAgentRoute } from './routes/agents.js';
import { handleContentRoute } from './routes/content.js';
import { handleKnowledgeRoute } from './routes/knowledge.js';
import { handleWorkflowRoute } from './routes/workflows.js';
import { handleCrmRoute } from './routes/crm.js';

export { HttpResult } from './http.js';
export { readinessSnapshot } from './readiness.js';

async function handleRoute({ services, context, membership, path, method, body }) {
  const segments = routeParts(path);
  const ai = providerReadiness();
  const systemRoute =
    path === '/health' ||
    path === '/account/export' ||
    path === '/account' ||
    segments[0] === 'api-keys' ||
    segments[0] === 'jobs' ||
    segments[0] === 'admin';

  if (systemRoute) {
    const result = await handleSystemRoute({
      services,
      context,
      membership,
      path,
      segments,
      method,
      body,
      ai,
      readinessSnapshot,
    });
    if (result !== null) return result;
  }

  if (segments[0] === 'billing')
    return handleBillingRoute({ services, context, membership, path, method, body });
  if (segments[0] === 'agents')
    return handleAgentRoute({ services, context, membership, segments, method, body, ai });
  if (segments[0] === 'content')
    return handleContentRoute({ services, context, membership, segments, method, body });
  if (segments[0] === 'kb')
    return handleKnowledgeRoute({ services, context, membership, segments, method, body });
  if (segments[0] === 'workflows')
    return handleWorkflowRoute({ services, context, membership, segments, method, body });
  if (segments[0] === 'crm')
    return handleCrmRoute({ services, context, membership, segments, method, body });
  if (segments[0] === 'admin') {
    requireAdmin(membership);
    throw new HttpError('管理功能正在安全重构中', 503, 'ADMIN_FEATURE_DISABLED');
  }
  throw new HttpError('函数路由不存在', 404, 'ROUTE_NOT_FOUND');
}

export default createRequestHandler({ handleRoute, readinessSnapshot });
