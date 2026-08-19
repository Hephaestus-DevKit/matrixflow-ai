import { ApiError } from './api-client';
import type { Locale } from './i18n';

const GENERIC_ERROR_COPY: Record<
  Locale,
  {
    operationFailed: string;
    network: string;
    timeout: string;
    unauthorized: string;
    forbidden: string;
    notFound: string;
    conflict: string;
    rateLimited: string;
    unavailable: string;
    preview: string;
    adminDisabled: string;
    paymentsDisabled: string;
    invalidRequest: string;
    tooLarge: string;
    aiUnavailable: string;
    aiUnauthorized: string;
    aiInvalid: string;
    quotaExceeded: string;
    planLimit: string;
  }
> = {
  'zh-CN': {
    operationFailed: '操作失败，请稍后重试',
    network: 'MatrixFlow 服务暂未启动，请稍后重试',
    timeout: 'MatrixFlow 服务响应超时，请稍后重试',
    unauthorized: '登录状态已失效，请重新登录',
    forbidden: '无权访问该团队资源',
    notFound: '资源不存在或已被删除',
    conflict: '资源状态发生冲突，请刷新后重试',
    rateLimited: '请求过于频繁，请稍后重试',
    unavailable: '核心服务暂时不可用，请稍后重试',
    preview: '该功能仍在受控预览中，当前暂未开放',
    adminDisabled: '管理模块正在安全重构中',
    paymentsDisabled: '付费结账尚未开放，当前不会产生扣款',
    invalidRequest: '请求参数有误，请检查后重试',
    tooLarge: '数据量超过当前限制，请缩小范围后重试',
    aiUnavailable: 'AI 服务暂时不可用，请检查协议配置后重试',
    aiUnauthorized: 'AI 服务凭证无效，请联系管理员检查 Appwrite Function 配置',
    aiInvalid: 'AI 请求或模型响应无效，请调整输入后重试',
    quotaExceeded: '本月 AI 额度已用尽，请升级套餐或下月再试',
    planLimit: '已达到当前套餐的资源上限，请升级套餐后继续',
  },
  'zh-TW': {
    operationFailed: '操作失敗，請稍後再試',
    network: 'MatrixFlow 服務尚未啟動，請稍後再試',
    timeout: 'MatrixFlow 服務回應逾時，請稍後再試',
    unauthorized: '登入狀態已失效，請重新登入',
    forbidden: '無權存取該團隊資源',
    notFound: '資源不存在或已被刪除',
    conflict: '資源狀態發生衝突，請重新整理後再試',
    rateLimited: '請求過於頻繁，請稍後再試',
    unavailable: '核心服務暫時不可用，請稍後再試',
    preview: '此功能仍在受控預覽中，目前尚未開放',
    adminDisabled: '管理模組正在安全重構中',
    paymentsDisabled: '付費結帳尚未開放，目前不會產生扣款',
    invalidRequest: '請求參數有誤，請檢查後再試',
    tooLarge: '資料量超過目前限制，請縮小範圍後再試',
    aiUnavailable: 'AI 服務暫時不可用，請檢查協議設定後再試',
    aiUnauthorized: 'AI 服務憑證無效，請聯絡管理員檢查 Appwrite Function 設定',
    aiInvalid: 'AI 請求或模型回應無效，請調整輸入後再試',
    quotaExceeded: '本月 AI 額度已用盡，請升級方案或下月再試',
    planLimit: '已達到目前方案的資源上限，請升級方案後繼續',
  },
  en: {
    operationFailed: 'Something went wrong. Try again shortly.',
    network: 'MatrixFlow is not available yet. Try again shortly.',
    timeout: 'MatrixFlow took too long to respond. Try again shortly.',
    unauthorized: 'Your session has expired. Sign in again.',
    forbidden: 'You do not have access to this team resource.',
    notFound: 'This resource no longer exists or was removed.',
    conflict: 'The resource changed. Refresh and try again.',
    rateLimited: 'Too many requests. Try again shortly.',
    unavailable: 'The core service is temporarily unavailable. Try again shortly.',
    preview: 'This feature is still in a controlled preview and is not open yet.',
    adminDisabled: 'The administration module is being rebuilt safely.',
    paymentsDisabled: 'Checkout is not available and creates no charge.',
    invalidRequest: 'Some request details are invalid. Check them and try again.',
    tooLarge: 'This request is larger than the current limit. Narrow the scope and try again.',
    aiUnavailable:
      'The AI service is temporarily unavailable. Check the protocol configuration and try again.',
    aiUnauthorized:
      'The AI credentials are invalid. Ask an administrator to check the Appwrite Function configuration.',
    aiInvalid: 'The AI request or model response was invalid. Adjust the input and try again.',
    quotaExceeded: 'This month’s AI quota is used up. Upgrade the plan or try again next month.',
    planLimit: 'This plan has reached its resource limit. Upgrade to continue.',
  },
};

const ERROR_COPY_BY_CODE: Record<string, keyof (typeof GENERIC_ERROR_COPY)['en']> = {
  NETWORK_ERROR: 'network',
  REQUEST_TIMEOUT: 'timeout',
  REQUEST_ABORTED: 'operationFailed',
  UNAUTHENTICATED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  RESOURCE_NOT_FOUND: 'notFound',
  ROUTE_NOT_FOUND: 'notFound',
  CONFLICT: 'conflict',
  IDEMPOTENCY_CONFLICT: 'conflict',
  IDEMPOTENCY_IN_PROGRESS: 'conflict',
  IDEMPOTENCY_REPLAY_UNAVAILABLE: 'conflict',
  RATE_LIMITED: 'rateLimited',
  general_rate_limit_exceeded: 'rateLimited',
  APPWRITE_ERROR: 'unavailable',
  FUNCTION_ERROR: 'unavailable',
  BACKEND_ERROR: 'unavailable',
  MARKETPLACE_PREVIEW: 'preview',
  FEATURE_PREVIEW: 'preview',
  ADMIN_FEATURE_DISABLED: 'adminDisabled',
  PAYMENTS_DISABLED: 'paymentsDisabled',
  METHOD_NOT_ALLOWED: 'invalidRequest',
  UNSUPPORTED_MEDIA_TYPE: 'invalidRequest',
  INVALID_REQUEST: 'invalidRequest',
  FILE_REQUIRED: 'invalidRequest',
  FILE_TOO_LARGE: 'tooLarge',
  FILE_NOT_FOUND: 'notFound',
  FILE_FORBIDDEN: 'forbidden',
  FILE_TYPE_INVALID: 'invalidRequest',
  UPLOAD_RETRY_CONFLICT: 'conflict',
  LIST_TOO_LARGE: 'tooLarge',
  DELETE_CONFIRMATION_REQUIRED: 'invalidRequest',
  API_KEY_INVALID: 'forbidden',
  API_KEY_SCOPES_INVALID: 'invalidRequest',
  API_KEY_SCOPE_REQUIRED: 'forbidden',
  ADMIN_REQUIRED: 'forbidden',
  ASYNC_WORKER_NOT_CONFIGURED: 'unavailable',
  JOB_WORKER_UNAUTHORIZED: 'forbidden',
  JOB_CONTEXT_INVALID: 'invalidRequest',
  JOB_TYPE_INVALID: 'invalidRequest',
  JOB_PAYLOAD_TOO_LARGE: 'tooLarge',
  CONNECTOR_NOT_CONFIGURED: 'preview',
  CONNECTOR_URL_INVALID: 'invalidRequest',
  CONNECTOR_URL_INSECURE: 'invalidRequest',
  CONNECTOR_URL_PRIVATE: 'forbidden',
  CONNECTOR_HOST_NOT_ALLOWED: 'forbidden',
  CONNECTOR_METHOD_INVALID: 'invalidRequest',
  BILLING_PROVIDER_NOT_CONFIGURED: 'paymentsDisabled',
  BILLING_WEBHOOK_NOT_CONFIGURED: 'paymentsDisabled',
  BILLING_SUBSCRIPTION_NOT_FOUND: 'conflict',
  BILLING_RETURN_URL_INVALID: 'invalidRequest',
  BILLING_PLAN_INVALID: 'invalidRequest',
  BILLING_CONFIG_INVALID: 'invalidRequest',
  BILLING_SIGNATURE_INVALID: 'forbidden',
  BILLING_EVENT_INVALID: 'invalidRequest',
  BILLING_EVENT_UNSUPPORTED: 'invalidRequest',
  KNOWLEDGE_BASE_EMPTY: 'invalidRequest',
  EMPTY_DOCUMENT: 'invalidRequest',
  AGENT_NOT_ACTIVE: 'conflict',
  AI_PROVIDER_UNAVAILABLE: 'aiUnavailable',
  AI_PROVIDER_ERROR: 'aiUnavailable',
  AI_NETWORK_ERROR: 'aiUnavailable',
  AI_TIMEOUT: 'aiUnavailable',
  AI_PROVIDER_AUTH: 'aiUnauthorized',
  AI_PROVIDER_BAD_REQUEST: 'aiInvalid',
  AI_PROVIDER_INVALID: 'aiInvalid',
  AI_MODEL_INVALID: 'aiInvalid',
  AI_INVALID_RESPONSE: 'aiInvalid',
  AI_INVALID_OUTPUT: 'aiInvalid',
  INVALID_AI_INPUT: 'aiInvalid',
  AI_INPUT_TOO_LARGE: 'tooLarge',
  AI_RESPONSE_TOO_LARGE: 'tooLarge',
  AI_SYSTEM_TOO_LARGE: 'tooLarge',
  AI_MONTHLY_QUOTA_EXCEEDED: 'quotaExceeded',
  AI_RATE_LIMITED: 'rateLimited',
  PLAN_LIMIT_EXCEEDED: 'planLimit',
};

function currentLocale(): Locale {
  if (typeof document === 'undefined') return 'zh-CN';
  const value = document.documentElement.lang;
  return value === 'en' || value === 'zh-TW' || value === 'zh-CN' ? value : 'zh-CN';
}

export function errorMessage(error: unknown, fallback?: string, locale?: Locale): string {
  const copy = GENERIC_ERROR_COPY[locale ?? currentLocale()];
  const code =
    error instanceof ApiError
      ? error.code
      : typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : undefined;
  const mappedKey = code ? ERROR_COPY_BY_CODE[code] : undefined;
  if (mappedKey) return copy[mappedKey];
  if (error instanceof ApiError) return fallback ?? copy.operationFailed;
  // Never surface raw Appwrite/provider messages: they may be localized to a
  // different language or contain implementation details. Map unknown errors
  // to the current locale and keep the original value in telemetry only.
  if (error instanceof Error && error.message) return fallback ?? copy.operationFailed;
  return fallback ?? copy.operationFailed;
}

interface ServiceError {
  code?: number | string;
  type?: string;
  message?: string;
}

const AUTH_ERROR_COPY: Record<
  Locale,
  {
    network: string;
    timeout: string;
    sync: string;
    invalidCredentials: string;
    alreadyExists: string;
    rateLimited: string;
    activeSession: string;
    unverified: string;
    invalidCode: string;
    mfaExpired: string;
  }
> = {
  'zh-CN': {
    network: 'MatrixFlow 服务暂未启动，请稍后重试',
    timeout: 'MatrixFlow 服务响应超时，请稍后重试',
    sync: '身份同步失败，请重新验证邮箱后登录',
    invalidCredentials: '邮箱或密码不正确',
    alreadyExists: '该邮箱已注册，请直接登录或使用邮箱验证码',
    rateLimited: '操作过于频繁，请稍后再试',
    activeSession: '当前账号已登录，请刷新页面',
    unverified: '邮箱尚未完成验证，请使用邮箱验证码登录',
    invalidCode: '验证码或恢复代码不正确',
    mfaExpired: '双重验证已过期，请重新登录',
  },
  'zh-TW': {
    network: 'MatrixFlow 服務尚未啟動，請稍後再試',
    timeout: 'MatrixFlow 服務回應逾時，請稍後再試',
    sync: '身份同步失敗，請重新驗證電子郵件後登入',
    invalidCredentials: '電子郵件或密碼不正確',
    alreadyExists: '此電子郵件已註冊，請直接登入或使用電子郵件驗證碼',
    rateLimited: '操作過於頻繁，請稍後再試',
    activeSession: '目前帳號已登入，請重新整理頁面',
    unverified: '電子郵件尚未完成驗證，請使用電子郵件驗證碼登入',
    invalidCode: '驗證碼或恢復代碼不正確',
    mfaExpired: '雙重驗證已逾期，請重新登入',
  },
  en: {
    network: 'MatrixFlow is not available yet. Try again shortly.',
    timeout: 'MatrixFlow took too long to respond. Try again shortly.',
    sync: 'Could not sync your identity. Verify your email and sign in again.',
    invalidCredentials: 'The email or password is incorrect.',
    alreadyExists: 'This email is already registered. Sign in or use email verification.',
    rateLimited: 'Too many attempts. Try again shortly.',
    activeSession: 'This account is already signed in. Refresh the page.',
    unverified: 'Your email is not verified yet. Use email verification to sign in.',
    invalidCode: 'The verification or recovery code is incorrect.',
    mfaExpired: 'Two-step verification expired. Sign in again.',
  },
};

export function authErrorMessage(
  error: unknown,
  fallback = '认证失败，请稍后重试',
  locale: Locale = 'zh-CN',
): string {
  const copy = AUTH_ERROR_COPY[locale];
  if (error instanceof ApiError) {
    if (error.code === 'NETWORK_ERROR') return copy.network;
    if (error.code === 'REQUEST_TIMEOUT') return copy.timeout;
    if (error.status === 401) return copy.sync;
  }

  const serviceError = error as ServiceError;
  if (String(serviceError.code) === 'MFA_CHALLENGE_EXPIRED') return copy.mfaExpired;
  switch (serviceError.type) {
    case 'user_invalid_credentials':
      return copy.invalidCredentials;
    case 'user_already_exists':
      return copy.alreadyExists;
    case 'general_rate_limit_exceeded':
      return copy.rateLimited;
    case 'user_session_already_exists':
      return copy.activeSession;
    case 'user_invalid_token':
      return copy.invalidCode;
    case 'user_mfa_challenge_expired':
      return copy.mfaExpired;
  }

  if (/verified email|邮箱尚未完成验证/i.test(serviceError.message ?? '')) {
    return copy.unverified;
  }
  return errorMessage(error, fallback, locale);
}
