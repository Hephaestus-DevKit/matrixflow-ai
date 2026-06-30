"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTemplate = exports.compilePrompt = exports.openaiProvider = exports.glmProvider = exports.AiGateway = void 0;
// AI Gateway 主入口：路由 + fallback + 缓存 + 重试 + token 计量
const providers_1 = require("./providers");
Object.defineProperty(exports, "glmProvider", { enumerable: true, get: function () { return providers_1.glmProvider; } });
Object.defineProperty(exports, "openaiProvider", { enumerable: true, get: function () { return providers_1.openaiProvider; } });
const render_1 = require("./prompt/render");
Object.defineProperty(exports, "compilePrompt", { enumerable: true, get: function () { return render_1.compilePrompt; } });
Object.defineProperty(exports, "renderTemplate", { enumerable: true, get: function () { return render_1.renderTemplate; } });
const config_1 = require("./config");
const PROVIDER_CHAIN = [providers_1.glmProvider, providers_1.openaiProvider];
const NOOP_CACHE = { get: async () => null, set: async () => { } };
const NOOP_SINK = async () => { };
class AiGateway {
    cache;
    usageSink;
    constructor(opts = {}) {
        this.cache = opts.cache || NOOP_CACHE;
        this.usageSink = opts.usageSink || NOOP_SINK;
    }
    async chat(req) {
        const cacheKey = req.cacheKey ? `ai:chat:${hash(req.cacheKey)}` : null;
        if (cacheKey) {
            const hit = await this.cache.get(cacheKey);
            if (hit) {
                const cached = JSON.parse(hit);
                cached.usage.cached = true;
                await this.usageSink(cached.usage, { organizationId: req.organizationId, agentId: req.agentId, cached: true });
                return cached;
            }
        }
        let lastErr = null;
        for (const provider of PROVIDER_CHAIN) {
            if (!provider.available())
                continue;
            for (let attempt = 0; attempt < config_1.AI_MAX_RETRY; attempt++) {
                try {
                    const res = await provider.chat(req);
                    await this.usageSink(res.usage, { organizationId: req.organizationId, agentId: req.agentId, cached: false });
                    if (cacheKey)
                        await this.cache.set(cacheKey, JSON.stringify(res), config_1.AI_CACHE_TTL_SECONDS);
                    return res;
                }
                catch (e) {
                    lastErr = e;
                    if (attempt < config_1.AI_MAX_RETRY - 1)
                        await sleep(config_1.AI_RETRY_BACKOFF_MS * 2 ** attempt);
                }
            }
        }
        throw new Error(`All AI providers failed: ${lastErr?.message}`);
    }
    async *chatStream(req) {
        for (const provider of PROVIDER_CHAIN) {
            if (!provider.available())
                continue;
            try {
                const gen = provider.chatStream(req);
                let chunk;
                while (!(chunk = await gen.next()).done) {
                    yield chunk.value;
                }
                const res = chunk.value;
                await this.usageSink(res.usage, { organizationId: req.organizationId, agentId: req.agentId, cached: false });
                return res;
            }
            catch (e) {
                continue;
            }
        }
        throw new Error('All AI providers failed (stream)');
    }
    async embed(req) {
        for (const provider of PROVIDER_CHAIN) {
            if (!provider.available())
                continue;
            try {
                const res = await provider.embed(req);
                await this.usageSink({ inputTokens: res.usage.inputTokens, outputTokens: 0, costUsd: res.usage.costUsd, cached: false, provider: provider.name, model: res.model }, { organizationId: req.organizationId, cached: false });
                return res;
            }
            catch (e) {
                continue;
            }
        }
        throw new Error('All embedding providers failed');
    }
}
exports.AiGateway = AiGateway;
function hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h) + s.charCodeAt(i);
        h |= 0;
    }
    return h.toString(16);
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
//# sourceMappingURL=index.js.map