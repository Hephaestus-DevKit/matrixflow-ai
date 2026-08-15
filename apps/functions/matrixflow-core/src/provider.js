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

function openAiEndpoint(value) {
  const base = normalizedBaseUrl(value, 'https://api.openai.com/v1');
  if (/\/chat\/completions$/i.test(base)) return base;
  return `${base}/chat/completions`;
}

function anthropicEndpoint(value) {
  const base = normalizedBaseUrl(value, 'https://api.anthropic.com');
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

function unavailable(provider) {
  const label =
    provider === 'anthropic'
      ? 'ANTHROPIC_API_KEY'
      : provider === 'glm'
        ? 'GLM_API_KEY'
        : 'OPENAI_API_KEY';
  throw new ProviderError(
    `尚未配置 ${provider === 'anthropic' ? 'Anthropic' : provider === 'glm' ? 'GLM' : 'OpenAI 兼容'} AI 服务密钥，请在 Appwrite Function 变量中设置 ${label}`,
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
 * - glm: GLM's OpenAI-compatible Chat Completions API (legacy alias)
 */
export function configuredProvider(env = process.env) {
  const requested = envValue(env, 'MATRIXFLOW_AI_PROVIDER', 'AI_PROVIDER').toLowerCase() || 'auto';
  const anthropicKey = envValue(env, 'ANTHROPIC_API_KEY');
  const glmKey = envValue(env, 'GLM_API_KEY');
  const openAiKey = envValue(env, 'OPENAI_API_KEY');

  if (!['auto', 'anthropic', 'openai', 'openai-compatible', 'glm'].includes(requested)) {
    throw new ProviderError(`不支持的 AI 服务协议：${requested}`, 500, 'AI_PROVIDER_INVALID');
  }

  if (requested === 'anthropic') {
    if (!anthropicKey) unavailable('anthropic');
    return {
      name: 'anthropic',
      protocol: 'anthropic-messages',
      endpoint: anthropicEndpoint(envValue(env, 'ANTHROPIC_BASE_URL')),
      apiKey: anthropicKey,
      model: envValue(env, 'ANTHROPIC_MODEL') || 'claude-3-5-haiku-latest',
      version: envValue(env, 'ANTHROPIC_VERSION') || ANTHROPIC_VERSION,
      beta: envValue(env, 'ANTHROPIC_BETA'),
    };
  }

  if (requested === 'glm') {
    if (!glmKey) unavailable('glm');
    return {
      name: 'glm',
      protocol: 'openai-chat-completions',
      endpoint:
        envValue(env, 'GLM_ENDPOINT') || 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      apiKey: glmKey,
      model: envValue(env, 'GLM_MODEL') || 'glm-4-plus',
    };
  }

  if (requested === 'openai' || requested === 'openai-compatible') {
    if (!openAiKey) unavailable('openai');
    return {
      name: 'openai',
      protocol: 'openai-chat-completions',
      endpoint: openAiEndpoint(envValue(env, 'OPENAI_BASE_URL', 'OPENAI_API_BASE')),
      apiKey: openAiKey,
      model: envValue(env, 'OPENAI_MODEL') || 'gpt-4o-mini',
      maxTokensField:
        envValue(env, 'OPENAI_MAX_TOKENS_FIELD') ||
        (requested === 'openai-compatible' ? 'max_tokens' : 'max_completion_tokens'),
      organization: envValue(env, 'OPENAI_ORGANIZATION', 'OPENAI_ORG_ID'),
      project: envValue(env, 'OPENAI_PROJECT'),
    };
  }

  // Auto mode preserves the legacy GLM-first behavior while allowing Anthropic
  // to be selected explicitly. This keeps existing deployments predictable.
  if (glmKey) {
    return {
      name: 'glm',
      protocol: 'openai-chat-completions',
      endpoint:
        envValue(env, 'GLM_ENDPOINT') || 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      apiKey: glmKey,
      model: envValue(env, 'GLM_MODEL') || 'glm-4-plus',
    };
  }
  if (anthropicKey) {
    return {
      name: 'anthropic',
      protocol: 'anthropic-messages',
      endpoint: anthropicEndpoint(envValue(env, 'ANTHROPIC_BASE_URL')),
      apiKey: anthropicKey,
      model: envValue(env, 'ANTHROPIC_MODEL') || 'claude-3-5-haiku-latest',
      version: envValue(env, 'ANTHROPIC_VERSION') || ANTHROPIC_VERSION,
      beta: envValue(env, 'ANTHROPIC_BETA'),
    };
  }
  if (openAiKey) {
    return {
      name: 'openai',
      protocol: 'openai-chat-completions',
      endpoint: openAiEndpoint(envValue(env, 'OPENAI_BASE_URL', 'OPENAI_API_BASE')),
      apiKey: openAiKey,
      model: envValue(env, 'OPENAI_MODEL') || 'gpt-4o-mini',
      maxTokensField: envValue(env, 'OPENAI_MAX_TOKENS_FIELD') || 'max_completion_tokens',
      organization: envValue(env, 'OPENAI_ORGANIZATION', 'OPENAI_ORG_ID'),
      project: envValue(env, 'OPENAI_PROJECT'),
    };
  }
  throw new ProviderError(
    '尚未配置 AI 服务密钥，请在 Appwrite Function 变量中设置 ANTHROPIC_API_KEY、GLM_API_KEY 或 OPENAI_API_KEY',
    503,
    'AI_PROVIDER_UNAVAILABLE',
  );
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
  const provider = configuredProvider(env);
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
  const safeRequestId =
    typeof requestId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(requestId)
      ? requestId
      : undefined;
  const request = requestFor(provider, {
    systemText,
    prompt,
    temperature: safeTemperature,
    maxTokens: safeMaxTokens,
    topP: safeTopP,
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
        stopReason: payload?.stop_reason || payload?.choices?.[0]?.finish_reason || null,
        durationMs: Date.now() - startedAt,
        upstreamRequestId:
          response.headers?.get?.('x-request-id') || response.headers?.get?.('request-id') || null,
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

export const providerCapabilities = Object.freeze({
  protocols: ['openai-chat-completions', 'anthropic-messages'],
  supportsStreaming: false,
  supportsTools: false,
});
