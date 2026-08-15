import { ApiError } from './api-client';
import type { Locale } from './i18n';

export function errorMessage(error: unknown, fallback = '操作失败，请稍后重试'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

interface ServiceError {
  code?: number;
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
  switch (serviceError.type) {
    case 'user_invalid_credentials':
      return copy.invalidCredentials;
    case 'user_already_exists':
      return copy.alreadyExists;
    case 'general_rate_limit_exceeded':
      return copy.rateLimited;
    case 'user_session_already_exists':
      return copy.activeSession;
  }

  if (/verified email|邮箱尚未完成验证/i.test(serviceError.message ?? '')) {
    return copy.unverified;
  }
  return errorMessage(error, fallback);
}
