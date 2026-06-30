"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openaiProvider = void 0;
// OpenAI 兼容 Provider (fallback) — 与 GLM 共享 OpenAI-compatible 协议
const config_1 = require("../config");
async function callOpenAI(path, body) {
    return fetch(`${config_1.OPENAI_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config_1.OPENAI_API_KEY}` },
        body: JSON.stringify(body),
    });
}
exports.openaiProvider = {
    name: 'openai',
    available: () => Boolean(config_1.OPENAI_API_KEY),
    async chat(req) {
        const model = req.model || config_1.OPENAI_DEFAULT_MODEL;
        const res = await callOpenAI('/chat/completions', {
            model,
            messages: req.messages,
            temperature: req.temperature ?? 0.7,
            max_tokens: req.maxTokens ?? 2000,
            response_format: req.responseFormat === 'json' ? { type: 'json_object' } : undefined,
        });
        if (!res.ok)
            throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
        const data = await res.json();
        const inputTokens = data.usage?.prompt_tokens ?? 0;
        const outputTokens = data.usage?.completion_tokens ?? 0;
        return {
            content: data.choices?.[0]?.message?.content ?? '',
            finishReason: data.choices?.[0]?.finish_reason ?? 'stop',
            usage: { inputTokens, outputTokens, cached: false, provider: 'openai', model, costUsd: this.estimateCost(inputTokens, outputTokens) },
        };
    },
    async *chatStream(req) {
        const model = req.model || config_1.OPENAI_DEFAULT_MODEL;
        const res = await callOpenAI('/chat/completions', {
            model, messages: req.messages, temperature: req.temperature ?? 0.7,
            max_tokens: req.maxTokens ?? 2000, stream: true, stream_options: { include_usage: true },
        });
        if (!res.ok || !res.body)
            throw new Error(`OpenAI stream ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '', full = '', inputTokens = 0, outputTokens = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() || '';
            for (const line of lines) {
                const t = line.trim();
                if (!t.startsWith('data:'))
                    continue;
                const payload = t.slice(5).trim();
                if (payload === '[DONE]')
                    continue;
                try {
                    const json = JSON.parse(payload);
                    const delta = json.choices?.[0]?.delta?.content || '';
                    if (delta) {
                        full += delta;
                        yield delta;
                    }
                    if (json.usage) {
                        inputTokens = json.usage.prompt_tokens ?? 0;
                        outputTokens = json.usage.completion_tokens ?? 0;
                    }
                }
                catch { /* skip */ }
            }
        }
        return { content: full, finishReason: 'stop', usage: { inputTokens, outputTokens, cached: false, provider: 'openai', model, costUsd: this.estimateCost(inputTokens, outputTokens) } };
    },
    async embed(req) {
        const inputs = Array.isArray(req.input) ? req.input : [req.input];
        const res = await callOpenAI('/embeddings', { model: req.model || 'text-embedding-3-small', input: inputs });
        if (!res.ok)
            throw new Error(`OpenAI embed ${res.status}`);
        const data = await res.json();
        return {
            embeddings: (data.data || []).map((d) => d.embedding),
            model: req.model || 'text-embedding-3-small',
            usage: { inputTokens: data.usage?.total_tokens ?? 0, costUsd: (data.usage?.total_tokens ?? 0) * 0.00002 / 1000 },
        };
    },
    estimateCost(inputTokens, outputTokens) {
        return (inputTokens * 0.00015 + outputTokens * 0.0006) / 1000;
    },
};
//# sourceMappingURL=openai.js.map