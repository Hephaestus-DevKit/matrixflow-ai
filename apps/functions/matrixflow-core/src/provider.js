const MAX_PROMPT_LENGTH = 16_000;
const PROVIDER_TIMEOUT_MS = 25_000;

export class ProviderError extends Error {
  constructor(message, status = 502, code = 'AI_PROVIDER_ERROR') {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.code = code;
  }
}

export function configuredProvider(env = process.env) {
  if (env.GLM_API_KEY) {
    return {
      name: 'glm',
      endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      apiKey: env.GLM_API_KEY,
      model: env.GLM_MODEL || 'glm-4-plus',
    };
  }
  if (env.OPENAI_API_KEY) {
    return {
      name: 'openai',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL || 'gpt-5-mini',
    };
  }
  throw new ProviderError(
    '尚未配置 AI 服务密钥，请先在 Appwrite 函数变量中设置 GLM_API_KEY 或 OPENAI_API_KEY',
    503,
    'AI_PROVIDER_UNAVAILABLE',
  );
}

export async function generateText({ system, prompt, temperature = 0.4 }, env = process.env) {
  if (typeof prompt !== 'string' || !prompt.trim())
    throw new ProviderError('AI 输入不能为空', 400, 'INVALID_AI_INPUT');
  if (prompt.length > MAX_PROMPT_LENGTH)
    throw new ProviderError('AI 输入过长，请缩短后重试', 413, 'AI_INPUT_TOO_LARGE');
  const provider = configuredProvider(env);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${provider.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: 'system', content: system || 'You are a precise business assistant.' },
          { role: 'user', content: prompt },
        ],
        temperature,
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new ProviderError(`AI 服务暂时不可用（${response.status}）`);
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim())
      throw new ProviderError('AI 服务返回了空结果');
    return {
      content: content.trim(),
      provider: provider.name,
      model: provider.model,
      usage: {
        inputTokens: Number(payload?.usage?.prompt_tokens ?? 0),
        outputTokens: Number(payload?.usage?.completion_tokens ?? 0),
      },
    };
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error?.name === 'AbortError') throw new ProviderError('AI 服务响应超时', 504, 'AI_TIMEOUT');
    throw new ProviderError('无法连接 AI 服务');
  } finally {
    clearTimeout(timeout);
  }
}
