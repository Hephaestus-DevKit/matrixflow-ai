import { HttpError } from './runtime.js';
import { isPrivateNetworkAddress } from './network.js';

function configuredAllowlist(env = process.env) {
  return String(env.MATRIXFLOW_CONNECTOR_ALLOWLIST || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function hostAllowed(hostname, allowlist) {
  return allowlist.some((entry) => {
    if (entry.startsWith('*.')) return hostname.endsWith(entry.slice(1));
    return hostname === entry;
  });
}

/** Validate a connector destination before any future network adapter uses it. */
export function validateOutboundUrl(value, env = process.env) {
  let url;
  try {
    url = new URL(String(value || '').trim());
  } catch {
    throw new HttpError('连接器地址不是有效 URL', 422, 'CONNECTOR_URL_INVALID');
  }
  const allowHttp =
    String(env.MATRIXFLOW_CONNECTOR_ALLOW_HTTP || '').toLowerCase() === 'true' &&
    String(env.NODE_ENV || 'production').toLowerCase() !== 'production';
  if (url.protocol !== 'https:' && !allowHttp)
    throw new HttpError('连接器只允许使用 HTTPS 地址', 422, 'CONNECTOR_URL_INSECURE');
  if (url.username || url.password || url.hash)
    throw new HttpError('连接器地址不得包含凭据或片段', 422, 'CONNECTOR_URL_INVALID');
  const hostname = url.hostname.toLowerCase();
  if (isPrivateNetworkAddress(hostname))
    throw new HttpError('连接器地址不能指向本地或私有网络', 422, 'CONNECTOR_URL_PRIVATE');
  const allowlist = configuredAllowlist(env);
  if (!allowlist.length || !hostAllowed(hostname, allowlist))
    throw new HttpError('连接器域名尚未加入出站白名单', 422, 'CONNECTOR_HOST_NOT_ALLOWED');
  return url.toString();
}

export function validateWebhookConfig(config, env = process.env) {
  const url = validateOutboundUrl(config?.url || config?.webhook, env);
  const method = String(config?.method || 'POST').toUpperCase();
  if (!['POST', 'PUT', 'PATCH'].includes(method))
    throw new HttpError('Webhook 只允许写入方法', 422, 'CONNECTOR_METHOD_INVALID');
  return { url, method };
}

export function connectorReadiness(env = process.env) {
  const allowlist = configuredAllowlist(env);
  return {
    configured: allowlist.length > 0,
    allowlistHosts: allowlist.length,
    email: Boolean(env.MATRIXFLOW_EMAIL_PROVIDER),
    webhook: allowlist.length > 0,
  };
}
