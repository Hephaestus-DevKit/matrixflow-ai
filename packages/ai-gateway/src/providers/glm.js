"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.glmProvider = void 0;
exports.glmMsg = glmMsg;
// GLM (智谱 BigModel) Provider — 主模型
const config_1 = require("../config");
const CHAT_URL = `${config_1.GLM_BASE_URL}/chat/completions`;
const EMBED_URL = `${config_1.GLM_BASE_URL}/embeddings`;
function estimateTokens(s) {
    const chinese = (s.match(/[\u4e00-\u9fa5]/g) || []).length;
    const english = (s.match(/[a-zA-Z]+/g) || []).length;
    return Math.ceil(chinese * 1.5 + english * 1.3);
}
exports.glmProvider = {
    name: 'glm',
    available() { return Boolean(config_1.GLM_API_KEY); },
    async chat(req) {
        if (!config_1.GLM_API_KEY)
            throw new Error('GLM_API_KEY not configured');
        const model = req.model || config_1.GLM_DEFAULT_MODEL;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), config_1.GLM_TIMEOUT_MS);
        try {
            const res = await fetch(CHAT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config_1.GLM_API_KEY}` },
                body: JSON.stringify({ model, messages: req.messages, temperature: req.temperature ?? 0.7, max_tokens: req.maxTokens ?? 2000, stream: false, response_format: req.responseFormat === 'json' ? { type: 'json_object' } : undefined }),
                signal: ctrl.signal,
            });
            if (!res.ok)
                throw new Error(`GLM chat ${res.status}: ${await res.text()}`);
            const data = await res.json();
            const content = data.choices?.[0]?.message?.content ?? '';
            const inputTokens = data.usage?.prompt_tokens ?? estimateTokens(JSON.stringify(req.messages));
            const outputTokens = data.usage?.completion_tokens ?? estimateTokens(content);
            return { content, finishReason: data.choices?.[0]?.finish_reason ?? 'stop', usage: { inputTokens, outputTokens, cached: false, provider: 'glm', model, costUsd: this.estimateCost(inputTokens, outputTokens) } };
        }
        finally {
            clearTimeout(timer);
        }
    },
    async *chatStream(req) {
        if (!config_1.GLM_API_KEY)
            throw new Error('GLM_API_KEY not configured');
        const model = req.model || config_1.GLM_DEFAULT_MODEL;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 120000);
        let inputTokens = 0, outputTokens = 0, full = '';
        try {
            const res = await fetch(CHAT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config_1.GLM_API_KEY}`, Accept: 'text/event-stream' },
                body: JSON.stringify({ model, messages: req.messages, temperature: req.temperature ?? 0.7, max_tokens: req.maxTokens ?? 2000, stream: true, stream_options: { include_usage: true } }),
                signal: ctrl.signal,
            });
            if (!res.ok || !res.body)
                throw new Error(`GLM stream ${res.status}: ${await res.text()}`);
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buf += decoder.decode(value, { stream: true });
                const lines = buf.split('\n');
                buf = lines.pop() || '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data:'))
                        continue;
                    const payload = trimmed.slice(5).trim();
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
                    catch { /* ignore */ }
                }
            }
            if (inputTokens === 0)
                inputTokens = estimateTokens(JSON.stringify(req.messages));
            if (outputTokens === 0)
                outputTokens = estimateTokens(full);
            return { content: full, finishReason: 'stop', usage: { inputTokens, outputTokens, cached: false, provider: 'glm', model, costUsd: this.estimateCost(inputTokens, outputTokens) } };
        }
        finally {
            clearTimeout(timer);
        }
    },
    async embed(req) {
        if (!config_1.GLM_API_KEY)
            throw new Error('GLM_API_KEY not configured');
        const inputs = Array.isArray(req.input) ? req.input : [req.input];
        const res = await fetch(EMBED_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config_1.GLM_API_KEY}` }, body: JSON.stringify({ model: req.model || 'embedding-3', input: inputs }) });
        if (!res.ok)
            throw new Error(`GLM embed ${res.status}: ${await res.text()}`);
        const data = await res.json();
        const embeddings = (data.data || []).map((d) => d.embedding);
        const inputTokens = data.usage?.total_tokens ?? inputs.reduce((s, t) => s + estimateTokens(t), 0);
        return { embeddings, model: req.model || 'embedding-3', usage: { inputTokens, costUsd: inputTokens * 0.0005 / 1000 } };
    },
    estimateCost(inputTokens, outputTokens) {
        return (inputTokens * 0.005 + outputTokens * 0.015) / 1000;
    },
};
function glmMsg(role, content) {
    return { role, content };
}
//# sourceMappingURL=glm.js.map