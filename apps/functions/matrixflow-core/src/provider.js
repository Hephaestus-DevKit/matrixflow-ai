import { isPrivateNetworkAddress } from './network.js';

const MAX_PROMPT_LENGTH = 16_000;
const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_MAX_TOKENS = 2_048;
const MAX_TOKENS = 32_000;
const MAX_RETRIES = 2;
const MAX_RESPONSE_BYTES = 512 * 1024;
const ANTHROPIC_VERSION = '2023-06-01';

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const envValue = (env, ...keys) => {
  for (const key of keys) {
    const value = text(env?.[key]);
    if (value) return value;
  }
  return '';
};

function normalizedBaseUrl(value, fallback) {
  return (text(value) || fallback).replace(/\/+$/, '');
}

/**
 * Provider endpoints are operator-controlled, but still deserve an explicit
 * egress policy. A typo such as an http URL or a private network address can
 * otherwise turn the AI adapter into an SSRF primitive when configuration is
 * copied between environments.
 */
export function validateProviderEndpoint(endpoint, env = process.env) {
  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new ProviderError('AI 服务端点不是有效 URL', 500, 'AI_PROVIDER_ENDPOINT_INVALID');
  }
  const allowInsecure = envValue(env, 'MATRIXFLOW_ALLOW_INSECURE_PROVIDER') === 'true';
  const allowPrivate = envValue(env, 'MATRIXFLOW_ALLOW_PRIVATE_PROVIDER') === 'true';
  const production = String(env?.NODE_ENV || 'production').toLowerCase() === 'production';
  if (parsed.protocol !== 'https:' && !(allowInsecure && !production))
    throw new ProviderError(
      '生产环境的 AI 服务端点必须使用 HTTPS',
      500,
      'AI_PROVIDER_ENDPOINT_INSECURE',
    );
  if (parsed.username || parsed.password || parsed.hash || parsed.search)
    throw new ProviderError(
      'AI 服务端点不得包含凭据、查询参数或片段',
      500,
      'AI_PROVIDER_ENDPOINT_INVALID',
    );
  const hostname = parsed.hostname.toLowerCase();
  if (isPrivateNetworkAddress(hostname) && !(allowPrivate && !production))
    throw new ProviderError(
      'AI 服务端点不能指向本地或私有网络地址',
      500,
      'AI_PROVIDER_ENDPOINT_PRIVATE',
    );
  return parsed.toString().replace(/\/$/, '');
}

function openAiEndpoint(value) {
  const base = normalizedBaseUrl(value, 'https://api.openai.com/v1');
  if (/\/chat\/completions$/i.test(base)) return base;
  return `${base}/chat/completions`;
}

function anthropicEndpoint(value) {
  const base = normalizedBaseUrl(value, 'https://api.anthropic.com');
  if (/\/v1\/messages$/i.test(base)) return base;
  return base.endsWith('/v1') ? `${base}/messages` : `${base}/v1/messages`;
}

export class ProviderError extends Error {
  constructor(message, status = 502, code = 'AI_PROVIDER_ERROR', details = undefined) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function providerDefinition(name, env, requested) {
  if (name === 'anthropic') {
    const apiKey = envValue(env, 'ANTHROPIC_API_KEY');
    if (!apiKey) unavailable('anthropic');
    return {
      name: 'anthropic',
      protocol: 'anthropic-messages',
      endpoint: validateProviderEndpoint(
        anthropicEndpoint(envValue(env, 'ANTHROPIC_BASE_URL')),
        env,
      ),
      apiKey,
      model: envValue(env, 'ANTHROPIC_MODEL') || 'claude-3-5-haiku-latest',
      version: envValue(env, 'ANTHROPIC_VERSION') || ANTHROPIC_VERSION,
      beta: envValue(env, 'ANTHROPIC_BETA'),
    };
  }
  if (name === 'glm') {
    const apiKey = envValue(env, 'GLM_API_KEY');
    if (!apiKey) unavailable('glm');
    return {
      name: 'glm',
      protocol: 'openai-chat-completions',
      endpoint: validateProviderEndpoint(
        envValue(env, 'GLM_ENDPOINT') || 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        env,
      ),
      apiKey,
      model: envValue(env, 'GLM_MODEL') || 'glm-4-plus',
      maxTokensField: 'max_tokens',
    };
  }
  // Token Rhythm is an OpenAI-compatible gateway. Keep its explicit aliases
  // separate from the generic OpenAI variables so operators can switch
  // gateways without changing application code or exposing secrets to Web.
  const configuredBaseUrl = envValue(
    env,
    'TOKENRHYTHM_BASE_URL',
    'OPENAI_BASE_URL',
    'OPENAI_API_BASE',
  );
  const tokenRhythm =
    requested === 'tokenrhythm' ||
    Boolean(envValue(env, 'TOKENRHYTHM_API_KEY')) ||
    /tokenrhythm\.studio/i.test(configuredBaseUrl);
  const apiKey = tokenRhythm
    ? envValue(env, 'TOKENRHYTHM_API_KEY', 'OPENAI_COMPATIBLE_API_KEY', 'OPENAI_API_KEY')
    : envValue(env, 'OPENAI_API_KEY', 'OPENAI_COMPATIBLE_API_KEY');
  if (!apiKey) unavailable(tokenRhythm ? 'tokenrhythm' : 'openai');
  const baseUrl = configuredBaseUrl || (tokenRhythm ? 'https://tokenrhythm.studio/v1' : '');
  return {
    name: tokenRhythm ? 'tokenrhythm' : 'openai',
    protocol: 'openai-chat-completions',
    endpoint: validateProviderEndpoint(openAiEndpoint(baseUrl), env),
    apiKey,
    model:
      envValue(env, 'TOKENRHYTHM_MODEL', 'OPENAI_MODEL') ||
      (tokenRhythm ? 'deepseek-v4-flash-0731' : 'gpt-4o-mini'),
    maxTokensField:
      envValue(env, 'OPENAI_MAX_TOKENS_FIELD') ||
      (requested === 'openai-compatible' || requested === 'tokenrhythm'
        ? 'max_tokens'
        : 'max_completion_tokens'),
    organization: envValue(env, 'OPENAI_ORGANIZATION', 'OPENAI_ORG_ID'),
    project: envValue(env, 'OPENAI_PROJECT'),
    gateway: tokenRhythm ? 'Token Rhythm' : undefined,
  };
}

function unavailable(provider) {
  const label =
    provider === 'anthropic'
      ? 'ANTHROPIC_API_KEY'
      : provider === 'glm'
        ? 'GLM_API_KEY'
        : provider === 'tokenrhythm'
          ? 'TOKENRHYTHM_API_KEY'
          : 'OPENAI_API_KEY';
  throw new ProviderError(
    `尚未配置 ${provider === 'anthropic' ? 'Anthropic' : provider === 'glm' ? 'GLM' : provider === 'tokenrhythm' ? 'Token Rhythm' : 'OpenAI 兼容'} AI 服务密钥，请在 Appwrite Function 变量中设置 ${label}`,
    503,
    'AI_PROVIDER_UNAVAILABLE',
  );
}

/**
 * Resolve the outbound provider without ever exposing a secret to callers.
 *
 * Supported values for MATRIXFLOW_AI_PROVIDER / AI_PROVIDER:
 * - auto (default): GLM, Anthropic, then OpenAI when their keys exist
 * - anthropic: native Anthropic Messages API
 * - openai: OpenAI Chat Completions protocol (also supports any compatible base URL)
 * - tokenrhythm: explicit Token Rhythm alias; uses the same OpenAI-compatible protocol
 * - glm: GLM's OpenAI-compatible Chat Completions API (legacy alias)
 */
export function configuredProvider(env = process.env) {
  const requested = envValue(env, 'MATRIXFLOW_AI_PROVIDER', 'AI_PROVIDER').toLowerCase() || 'auto';
  if (
    !['auto', 'anthropic', 'openai', 'openai-compatible', 'tokenrhythm', 'glm'].includes(requested)
  ) {
    throw new ProviderError(`不支持的 AI 服务协议：${requested}`, 500, 'AI_PROVIDER_INVALID');
  }
  return configuredProviders(env)[0];
}

/** Return the ordered provider pool used for automatic failover. */
export function configuredProviders(env = process.env) {
  const requested = envValue(env, 'MATRIXFLOW_AI_PROVIDER', 'AI_PROVIDER').toLowerCase() || 'auto';
  if (
    !['auto', 'anthropic', 'openai', 'openai-compatible', 'tokenrhythm', 'glm'].includes(requested)
  )
    throw new ProviderError(`不支持的 AI 服务协议：${requested}`, 500, 'AI_PROVIDER_INVALID');
  if (requested === 'anthropic') return [providerDefinition('anthropic', env, requested)];
  if (requested === 'glm') return [providerDefinition('glm', env, requested)];
  if (requested === 'openai' || requested === 'openai-compatible' || requested === 'tokenrhythm')
    return [providerDefinition('openai', env, requested)];

  const providers = [];
  // Keep the existing GLM-first order for backwards compatibility while
  // allowing a configured Anthropic/OpenAI fallback to keep requests alive.
  if (envValue(env, 'GLM_API_KEY')) providers.push(providerDefinition('glm', env, requested));
  if (envValue(env, 'ANTHROPIC_API_KEY'))
    providers.push(providerDefinition('anthropic', env, requested));
  if (envValue(env, 'TOKENRHYTHM_API_KEY', 'OPENAI_API_KEY', 'OPENAI_COMPATIBLE_API_KEY'))
    providers.push(providerDefinition('openai', env, requested));
  if (!providers.length)
    throw new ProviderError(
      '尚未配置 AI 服务密钥，请在 Appwrite Function 变量中设置 ANTHROPIC_API_KEY、OPENAI_API_KEY、OPENAI_COMPATIBLE_API_KEY 或 TOKENRHYTHM_API_KEY',
      503,
      'AI_PROVIDER_UNAVAILABLE',
    );
  return providers;
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function boundedInteger(value, fallback, min, max) {
  return Math.round(boundedNumber(value, fallback, min, max));
}

function safeUsageValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

/**
 * Estimate provider cost from an operator-supplied price table. Pricing is
 * intentionally configuration-driven because provider prices change; missing
 * prices produce 0 rather than inventing a charge. Example:
 * {"openai:gpt-4o-mini":{"inputPer1k":0.00015,"outputPer1k":0.0006}}
 */
export function estimateCostUsd(providerName, model, usage, env = process.env) {
  const raw = text(env?.MATRIXFLOW_AI_PRICING_JSON);
  if (!raw) return 0;
  let pricing;
  try {
    pricing = JSON.parse(raw);
  } catch {
    return 0;
  }
  const entry =
    pricing?.[`${providerName}:${model}`] || pricing?.[model] || pricing?.[providerName] || {};
  const inputRate = Number(entry.inputPer1k);
  const outputRate = Number(entry.outputPer1k);
  if (!Number.isFinite(inputRate) || !Number.isFinite(outputRate)) return 0;
  const inputTokens = safeUsageValue(usage?.inputTokens);
  const outputTokens = safeUsageValue(usage?.outputTokens);
  return Math.max(0, (inputTokens / 1_000) * inputRate + (outputTokens / 1_000) * outputRate);
}

function openAiContent(payload) {
  const value = payload?.choices?.[0]?.message?.content;
  if (typeof value === 'string') return value;
  if (Array.isArray(value))
    return value
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join(' ');
  return '';
}

function anthropicContent(payload) {
  if (!Array.isArray(payload?.content)) return '';
  return payload.content
    .filter((part) => part?.type === 'text')
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join(' ');
}

function responseError(payload, status) {
  const message = text(payload?.error?.message) || text(payload?.message) || 'AI 服务请求失败';
  if (status === 401 || status === 403)
    return new ProviderError('AI 服务凭证无效或无权访问当前模型', 502, 'AI_PROVIDER_AUTH');
  if (status === 429)
    return new ProviderError('AI 服务已限流，请稍后重试', 429, 'AI_PROVIDER_RATE_LIMITED');
  if (status >= 400 && status < 500)
    return new ProviderError(
      `AI 请求参数被服务拒绝：${message.slice(0, 240)}`,
      502,
      'AI_PROVIDER_BAD_REQUEST',
    );
  return new ProviderError(`AI 服务暂时不可用（${status}）`, 502, 'AI_PROVIDER_ERROR');
}

function requestFor(
  provider,
  { systemText, prompt, temperature, maxTokens, topP, model, requestId },
) {
  if (provider.protocol === 'anthropic-messages') {
    const headers = {
      'x-api-key': provider.apiKey,
      'anthropic-version': provider.version,
      'content-type': 'application/json',
    };
    if (requestId) headers['x-client-request-id'] = requestId;
    if (provider.beta) headers['anthropic-beta'] = provider.beta;
    return {
      headers,
      body: {
        model,
        max_tokens: maxTokens,
        system: systemText || 'You are a precise business assistant.',
        messages: [{ role: 'user', content: prompt }],
        temperature,
        ...(topP === undefined ? {} : { top_p: topP }),
      },
    };
  }
  const headers = {
    authorization: `Bearer ${provider.apiKey}`,
    'content-type': 'application/json',
  };
  if (requestId) headers['X-Client-Request-Id'] = requestId;
  if (provider.organization) headers['OpenAI-Organization'] = provider.organization;
  if (provider.project) headers['OpenAI-Project'] = provider.project;
  const tokenLimit =
    provider.maxTokensField === 'max_completion_tokens'
      ? { max_completion_tokens: maxTokens }
      : { max_tokens: maxTokens };
  return {
    headers,
    body: {
      model,
      messages: [
        { role: 'system', content: systemText || 'You are a precise business assistant.' },
        { role: 'user', content: prompt },
      ],
      temperature,
      ...tokenLimit,
      ...(topP === undefined ? {} : { top_p: topP }),
    },
  };
}

function retryable(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response.headers?.get?.('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.min(1_500, retryAfter * 1_000);
  return Math.min(1_000, 250 * 2 ** attempt);
}

function canFailover(error) {
  return [
    'AI_PROVIDER_ERROR',
    'AI_PROVIDER_RATE_LIMITED',
    'AI_NETWORK_ERROR',
    'AI_TIMEOUT',
    'AI_INVALID_RESPONSE',
    'AI_INVALID_OUTPUT',
  ].includes(error?.code);
}

async function generateWithProvider(
  provider,
  { systemText, prompt, temperature, maxTokens, topP, model, safeRequestId },
  env,
) {
  const requestedModel = model === undefined ? provider.model : text(model);
  if (
    !requestedModel ||
    requestedModel.length > 100 ||
    /[\u0000-\u001f\u007f]/.test(requestedModel)
  )
    throw new ProviderError('AI 模型标识无效', 400, 'AI_MODEL_INVALID');
  const timeoutMs = boundedInteger(
    envValue(env, 'MATRIXFLOW_AI_TIMEOUT_MS'),
    DEFAULT_TIMEOUT_MS,
    5_000,
    60_000,
  );
  const retries = boundedInteger(
    envValue(env, 'MATRIXFLOW_AI_MAX_RETRIES'),
    MAX_RETRIES,
    0,
    MAX_RETRIES,
  );
  const request = requestFor(provider, {
    systemText,
    prompt,
    temperature,
    maxTokens,
    topP,
    model: requestedModel,
    requestId: safeRequestId,
  });
  const startedAt = Date.now();

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(provider.endpoint, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(request.body),
        signal: controller.signal,
      });
      const responseText =
        typeof response.text === 'function'
          ? await response.text()
          : JSON.stringify(await response.json().catch(() => ({})));
      if (Buffer.byteLength(responseText, 'utf8') > MAX_RESPONSE_BYTES)
        throw new ProviderError('AI 服务响应过大', 502, 'AI_RESPONSE_TOO_LARGE');
      let payload = {};
      try {
        payload = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new ProviderError('AI 服务返回了无效响应', 502, 'AI_INVALID_RESPONSE');
      }
      if (!response.ok) {
        if (retryable(response.status) && attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
          continue;
        }
        throw responseError(payload, response.status);
      }
      const content =
        provider.protocol === 'anthropic-messages'
          ? anthropicContent(payload)
          : openAiContent(payload);
      if (!content.trim()) throw new ProviderError('AI 服务返回了空结果', 502, 'AI_INVALID_OUTPUT');
      const usage =
        provider.protocol === 'anthropic-messages'
          ? {
              inputTokens: safeUsageValue(payload?.usage?.input_tokens),
              outputTokens: safeUsageValue(payload?.usage?.output_tokens),
            }
          : {
              inputTokens: safeUsageValue(payload?.usage?.prompt_tokens),
              outputTokens: safeUsageValue(payload?.usage?.completion_tokens),
            };
      return {
        content: content.trim(),
        provider: provider.name,
        protocol: provider.protocol,
        model: requestedModel,
        usage,
        costUsd: estimateCostUsd(provider.name, requestedModel, usage, env),
        stopReason: payload?.stop_reason || payload?.choices?.[0]?.finish_reason || null,
        durationMs: Date.now() - startedAt,
        upstreamRequestId:
          response.headers?.get?.('x-request-id') || response.headers?.get?.('request-id') || null,
        requestId: safeRequestId || null,
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (error?.name === 'AbortError') {
        if (attempt < retries) continue;
        throw new ProviderError('AI 服务响应超时', 504, 'AI_TIMEOUT');
      }
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(1_000, 250 * 2 ** attempt)));
        continue;
      }
      throw new ProviderError('无法连接 AI 服务', 502, 'AI_NETWORK_ERROR');
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new ProviderError('AI 服务暂时不可用');
}

/** Generate one text response through a native or OpenAI-compatible protocol. */
export async function generateText(
  { system, prompt, temperature = 0.4, maxTokens = DEFAULT_MAX_TOKENS, topP, model, requestId },
  env = process.env,
) {
  if (typeof prompt !== 'string' || !prompt.trim())
    throw new ProviderError('AI 输入不能为空', 400, 'INVALID_AI_INPUT');
  if (prompt.length > MAX_PROMPT_LENGTH)
    throw new ProviderError('AI 输入过长，请缩短后重试', 413, 'AI_INPUT_TOO_LARGE');
  const systemText = typeof system === 'string' ? system : String(system || '');
  if (systemText.length > MAX_PROMPT_LENGTH)
    throw new ProviderError('AI 系统指令过长，请缩短后重试', 413, 'AI_SYSTEM_TOO_LARGE');
  const safeTemperature = boundedNumber(temperature, 0.4, 0, 2);
  const safeMaxTokens = boundedInteger(maxTokens, DEFAULT_MAX_TOKENS, 1, MAX_TOKENS);
  const safeTopP = topP === undefined ? undefined : boundedNumber(topP, 1, 0, 1);
  const safeRequestId =
    typeof requestId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(requestId)
      ? requestId
      : undefined;
  const providers = configuredProviders(env);
  const requested = envValue(env, 'MATRIXFLOW_AI_PROVIDER', 'AI_PROVIDER').toLowerCase() || 'auto';
  const allowFallback =
    providers.length > 1 &&
    (requested === 'auto' || envValue(env, 'MATRIXFLOW_AI_FALLBACK') === 'true');
  let lastError;
  for (let index = 0; index < providers.length; index += 1) {
    try {
      const result = await generateWithProvider(
        providers[index],
        {
          systemText,
          prompt,
          temperature: safeTemperature,
          maxTokens: safeMaxTokens,
          topP: safeTopP,
          model,
          safeRequestId,
        },
        env,
      );
      return {
        ...result,
        fallbackUsed: index > 0,
        attemptedProviders: providers.slice(0, index + 1).map((item) => item.name),
      };
    } catch (error) {
      lastError = error;
      if (!allowFallback || !canFailover(error) || index >= providers.length - 1) throw error;
    }
  }
  throw lastError || new ProviderError('AI 服务暂时不可用');
}

export const providerCapabilities = Object.freeze({
  protocols: ['openai-chat-completions', 'anthropic-messages'],
  supportsStreaming: false,
  supportsTools: false,
  supportsFailover: true,
});
