import test from 'node:test';
import assert from 'node:assert/strict';
import { configuredProvider, generateText } from '../src/provider.js';

test('fails closed when no provider is configured', () => {
  assert.throws(
    () => configuredProvider({}),
    (error) => error.code === 'AI_PROVIDER_UNAVAILABLE',
  );
});

test('prefers GLM when both providers are configured', () => {
  assert.equal(configuredProvider({ GLM_API_KEY: 'one', OPENAI_API_KEY: 'two' }).name, 'glm');
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
