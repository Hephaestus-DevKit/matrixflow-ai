"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_CACHE_TTL_SECONDS = exports.AI_RETRY_BACKOFF_MS = exports.AI_MAX_RETRY = exports.GEMINI_API_KEY = exports.ANTHROPIC_DEFAULT_MODEL = exports.ANTHROPIC_API_KEY = exports.OPENAI_DEFAULT_MODEL = exports.OPENAI_BASE_URL = exports.OPENAI_API_KEY = exports.GLM_TIMEOUT_MS = exports.GLM_DEFAULT_MODEL = exports.GLM_BASE_URL = exports.GLM_API_KEY = void 0;
// 配置：从环境变量读取（不硬编码）
exports.GLM_API_KEY = process.env.GLM_API_KEY || '';
exports.GLM_BASE_URL = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
exports.GLM_DEFAULT_MODEL = process.env.GLM_DEFAULT_MODEL || 'glm-4-plus';
exports.GLM_TIMEOUT_MS = Number(process.env.GLM_TIMEOUT_MS || 60000);
exports.OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
exports.OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
exports.OPENAI_DEFAULT_MODEL = process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o-mini';
exports.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
exports.ANTHROPIC_DEFAULT_MODEL = process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-5-sonnet-latest';
exports.GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
exports.AI_MAX_RETRY = Number(process.env.AI_MAX_RETRY || 3);
exports.AI_RETRY_BACKOFF_MS = Number(process.env.AI_RETRY_BACKOFF_MS || 500);
exports.AI_CACHE_TTL_SECONDS = Number(process.env.AI_CACHE_TTL_SECONDS || 3600);
//# sourceMappingURL=config.js.map