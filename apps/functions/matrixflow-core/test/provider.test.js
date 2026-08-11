import test from 'node:test';
import assert from 'node:assert/strict';
import { configuredProvider } from '../src/provider.js';

test('fails closed when no provider is configured', () => {
  assert.throws(
    () => configuredProvider({}),
    (error) => error.code === 'AI_PROVIDER_UNAVAILABLE',
  );
});

test('prefers GLM when both providers are configured', () => {
  assert.equal(configuredProvider({ GLM_API_KEY: 'one', OPENAI_API_KEY: 'two' }).name, 'glm');
});
