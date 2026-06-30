// @matrixflow/shared · 常量
export const APP_NAME = 'MatrixFlow AI';
export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

// 错误码
export const ErrorCode = {
  // 通用 1xxx
  INTERNAL: 'INTERNAL',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  // 认证 2xxx
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  // 组织 3xxx
  ORG_NOT_FOUND: 'ORG_NOT_FOUND',
  MEMBER_EXISTS: 'MEMBER_EXISTS',
  MEMBER_LIMIT_EXCEEDED: 'MEMBER_LIMIT_EXCEEDED',
  // AI 4xxx
  AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
  AI_RATE_LIMITED: 'AI_RATE_LIMITED',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_INVALID_OUTPUT: 'AI_INVALID_OUTPUT',
  // 计费 5xxx
  PLAN_LIMIT_EXCEEDED: 'PLAN_LIMIT_EXCEEDED',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

// 角色
export const RoleName = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;
export type RoleName = typeof RoleName[keyof typeof RoleName];

// Agent 状态
export const AgentStatus = { DRAFT: 'DRAFT', ACTIVE: 'ACTIVE', ARCHIVED: 'ARCHIVED' } as const;
export const RunStatus = { PENDING: 'PENDING', RUNNING: 'RUNNING', SUCCESS: 'SUCCESS', FAILED: 'FAILED', CANCELED: 'CANCELED' } as const;

// AI Provider
export const Provider = { GLM: 'glm', OPENAI: 'openai', ANTHROPIC: 'anthropic', GEMINI: 'gemini' } as const;
export type Provider = typeof Provider[keyof typeof Provider];

// 权限 action
export const Action = {
  AGENT_READ: 'agent:read', AGENT_WRITE: 'agent:write', AGENT_RUN: 'agent:run',
  CONTENT_READ: 'content:read', CONTENT_WRITE: 'content:write',
  KB_READ: 'kb:read', KB_WRITE: 'kb:write',
  WORKFLOW_READ: 'workflow:read', WORKFLOW_WRITE: 'workflow:write', WORKFLOW_RUN: 'workflow:run',
  CRM_READ: 'crm:read', CRM_WRITE: 'crm:write',
  ORG_MANAGE: 'org:manage', BILLING_MANAGE: 'billing:manage',
} as const;
export type Action = typeof Action[keyof typeof Action];
