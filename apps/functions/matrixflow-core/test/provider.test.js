import test from 'node:test';
import assert from 'node:assert/strict';
import {
  configuredProvider,
  configuredProviders,
  generateText,
  validateProviderEndpoint,
} from '../src/provider.js';

test('fails closed when no provider is configured', () => {
  assert.throws(
    () => configuredProvider({}),
    (error) => error.code === 'AI_PROVIDER_UNAVAILABLE',
  );
});

test('prefers GLM when both providers are configured', () => {
  assert.equal(configuredProvider({ GLM_API_KEY: 'one', OPENAI_API_KEY: 'two' }).name, 'glm');
});

test('auto mode exposes an ordered failover pool without exposing secrets', () => {
  const providers = configuredProviders({
    GLM_API_KEY: 'glm-secret',
    ANTHROPIC_API_KEY: 'anthropic-secret',
    OPENAI_API_KEY: 'openai-secret',
  });
  assert.deepEqual(
    providers.map(({ name, apiKey }) => ({ name, hasKey: Boolean(apiKey) })),
    [
      { name: 'glm', hasKey: true },
      { name: 'anthropic', hasKey: true },
      { name: 'openai', hasKey: true },
    ],
  );
});

test('provider endpoints reject unsafe production configuration', () => {
  assert.throws(
    () => validateProviderEndpoint('http://api.example.com/v1', { NODE_ENV: 'production' }),
    (error) => error.code === 'AI_PROVIDER_ENDPOINT_INSECURE',
  );
  assert.throws(
    () => validateProviderEndpoint('https://127.0.0.1/v1', { NODE_ENV: 'production' }),
    (error) => error.code === 'AI_PROVIDER_ENDPOINT_PRIVATE',
  );
  assert.throws(
    () => validateProviderEndpoint('https://[fe80::1]/v1', { NODE_ENV: 'production' }),
    (error) => error.code === 'AI_PROVIDER_ENDPOINT_PRIVATE',
  );
  assert.throws(
    () => validateProviderEndpoint('https://api.example.com/v1?token=secret', {}),
    (error) => error.code === 'AI_PROVIDER_ENDPOINT_INVALID',
  );
  assert.equal(
    validateProviderEndpoint('http://localhost:8080/v1', {
      NODE_ENV: 'development',
      MATRIXFLOW_ALLOW_INSECURE_PROVIDER: 'true',
      MATRIXFLOW_ALLOW_PRIVATE_PROVIDER: 'true',
    }),
    'http://localhost:8080/v1',
  );
});

test('resolves native Anthropic Messages protocol explicitly', () => {
  const provider = configuredProvider({
    MATRIXFLOW_AI_PROVIDER: 'anthropic',
    ANTHROPIC_API_KEY: 'secret',
    ANTHROPIC_MODEL: 'claude-test',
    ANTHROPIC_BASE_URL: 'https://proxy.example/v1/',
  });
  assert.deepEqual(
    {
      name: provider.name,
      protocol: provider.protocol,
      model: provider.model,
      endpoint: provider.endpoint,
    },
    {
      name: 'anthropic',
      protocol: 'anthropic-messages',
      model: 'claude-test',
      endpoint: 'https://proxy.example/v1/messages',
    },
  );
});

test('preserves a full Anthropic Messages endpoint supplied by a gateway', () => {
  assert.equal(
    configuredProvider({
      MATRIXFLOW_AI_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'secret',
      ANTHROPIC_BASE_URL: 'https://gateway.example/v1/messages/',
    }).endpoint,
    'https://gateway.example/v1/messages',
  );
});

test('uses modern token limit field for first-party OpenAI and legacy field for gateways', () => {
  assert.equal(
    configuredProvider({ MATRIXFLOW_AI_PROVIDER: 'openai', OPENAI_API_KEY: 'secret' })
      .maxTokensField,
    'max_completion_tokens',
  );
  assert.equal(
    configuredProvider({ MATRIXFLOW_AI_PROVIDER: 'openai-compatible', OPENAI_API_KEY: 'secret' })
      .maxTokensField,
    'max_tokens',
  );
});

test('does not duplicate the Chat Completions path for a full compatible endpoint', () => {
  assert.equal(
    configuredProvider({
      MATRIXFLOW_AI_PROVIDER: 'openai-compatible',
      OPENAI_API_KEY: 'secret',
      OPENAI_BASE_URL: 'https://gateway.example/v1/chat/completions/',
    }).endpoint,
    'https://gateway.example/v1/chat/completions',
  );
});

test('resolves Token Rhythm aliases with safe defaults', () => {
  const provider = configuredProvider({
    MATRIXFLOW_AI_PROVIDER: 'tokenrhythm',
    TOKENRHYTHM_API_KEY: 'tokenrhythm-secret',
  });
  assert.deepEqual(
    {
      name: provider.name,
      gateway: provider.gateway,
      endpoint: provider.endpoint,
      model: provider.model,
      maxTokensField: provider.maxTokensField,
    },
    {
      name: 'tokenrhythm',
      gateway: 'Token Rhythm',
      endpoint: 'https://tokenrhythm.studio/v1/chat/completions',
      model: 'deepseek-v4-flash-0731',
      maxTokensField: 'max_tokens',
    },
  );
});

test('sends Anthropic headers and normalizes content and usage', async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: 'text', text: '  hello from Claude  ' }],
        usage: { input_tokens: 11, output_tokens: 7 },
        stop_reason: 'end_turn',
      }),
    };
  };
  try {
    const result = await generateText(
      { system: 'system', prompt: 'question', temperature: 0.2, maxTokens: 123 },
      {
        MATRIXFLOW_AI_PROVIDER: 'anthropic',
        ANTHROPIC_API_KEY: 'anthropic-secret',
        ANTHROPIC_MODEL: 'claude-test',
        MATRIXFLOW_AI_MAX_RETRIES: '0',
      },
    );
    const body = JSON.parse(request.options.body);
    assert.equal(request.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(request.options.headers['x-api-key'], 'anthropic-secret');
    assert.equal(request.options.headers.authorization, undefined);
    assert.equal(body.max_tokens, 123);
    assert.equal(body.system, 'system');
    assert.deepEqual(result.usage, { inputTokens: 11, outputTokens: 7 });
    assert.equal(result.content, 'hello from Claude');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sends OpenAI-compatible payload and retries transient failures', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let lastRequest;
  globalThis.fetch = async (_url, options) => {
    calls += 1;
    lastRequest = options;
    if (calls === 1)
      return { ok: false, status: 503, headers: { get: () => null }, json: async () => ({}) };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          { message: { content: [{ type: 'text', text: 'done' }] }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: 3, completion_tokens: 4 },
      }),
    };
  };
  try {
    const result = await generateText(
      { system: 'system', prompt: 'question', maxTokens: 99 },
      {
        MATRIXFLOW_AI_PROVIDER: 'openai-compatible',
        OPENAI_API_KEY: 'openai-secret',
        OPENAI_BASE_URL: 'https://gateway.example/v1/',
        OPENAI_MODEL: 'compatible-model',
        MATRIXFLOW_AI_MAX_RETRIES: '1',
      },
    );
    const body = JSON.parse(lastRequest.body);
    assert.equal(calls, 2);
    assert.equal(result.provider, 'openai');
    assert.equal(lastRequest.headers.authorization, 'Bearer openai-secret');
    assert.equal(body.model, 'compatible-model');
    assert.equal(body.max_tokens, 99);
    assert.deepEqual(result.usage, { inputTokens: 3, outputTokens: 4 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('auto mode fails over to Anthropic after a transient GLM outage', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (String(url).includes('openai.example'))
      return { ok: false, status: 503, headers: { get: () => null }, text: async () => '{}' };
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () =>
        JSON.stringify({
          content: [{ type: 'text', text: 'fallback ok' }],
          usage: { input_tokens: 2, output_tokens: 3 },
        }),
    };
  };
  try {
    const result = await generateText(
      { prompt: 'hello', requestId: 'fallback-test' },
      {
        MATRIXFLOW_AI_PROVIDER: 'auto',
        MATRIXFLOW_AI_MAX_RETRIES: '0',
        GLM_API_KEY: 'glm-secret',
        GLM_ENDPOINT: 'https://openai.example/v1/chat/completions',
        GLM_MODEL: 'glm-test',
        ANTHROPIC_API_KEY: 'anthropic-secret',
        ANTHROPIC_BASE_URL: 'https://anthropic.example',
        ANTHROPIC_MODEL: 'claude-test',
      },
    );
    assert.equal(result.content, 'fallback ok');
    assert.equal(result.provider, 'anthropic');
    assert.equal(result.fallbackUsed, true);
    assert.deepEqual(result.attemptedProviders, ['glm', 'anthropic']);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('propagates a safe request id and rejects oversized upstream responses', async () => {
  const originalFetch = globalThis.fetch;
  let requestOptions;
  globalThis.fetch = async (_url, options) => {
    requestOptions = options;
    return {
      ok: true,
      status: 200,
      headers: { get: (name) => (name === 'x-request-id' ? 'upstream-123' : null) },
      text: async () =>
        JSON.stringify({
          choices: [{ message: { content: 'ok' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
    };
  };
  try {
    const result = await generateText(
      { prompt: 'hello', requestId: 'request-123' },
      { OPENAI_API_KEY: 'secret', MATRIXFLOW_AI_MAX_RETRIES: '0' },
    );
    assert.equal(requestOptions.headers['X-Client-Request-Id'], 'request-123');
    assert.equal(result.upstreamRequestId, 'upstream-123');
    assert.equal(typeof result.durationMs, 'number');
  } finally {
    globalThis.fetch = originalFetch;
  }

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => `{"choices":[{"message":{"content":"${'x'.repeat(512 * 1024)}"}}]}`,
  });
  try {
    await assert.rejects(
      () =>
        generateText(
          { prompt: 'hello' },
          { OPENAI_API_KEY: 'secret', MATRIXFLOW_AI_MAX_RETRIES: '0' },
        ),
      (error) => error.code === 'AI_RESPONSE_TOO_LARGE',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('bounds system instructions before network access', async () => {
  await assert.rejects(
    () => generateText({ system: 'x'.repeat(16_001), prompt: 'hello' }, { GLM_API_KEY: 'test' }),
    (error) => error.code === 'AI_SYSTEM_TOO_LARGE',
  );
});
