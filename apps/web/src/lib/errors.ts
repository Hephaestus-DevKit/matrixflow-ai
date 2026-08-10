import { ApiError } from './api-client';

export function errorMessage(error: unknown, fallback = '操作失败，请稍后重试'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

interface ServiceError {
  code?: number;
  type?: string;
  message?: string;
}

export function authErrorMessage(error: unknown, fallback = '认证失败，请稍后重试'): string {
  if (error instanceof ApiError) {
    if (error.code === 'NETWORK_ERROR') return 'MatrixFlow 服务暂未启动，请稍后重试';
    if (error.code === 'REQUEST_TIMEOUT') return 'MatrixFlow 服务响应超时，请稍后重试';
    if (error.status === 401) return '身份同步失败，请重新验证邮箱后登录';
  }

  const serviceError = error as ServiceError;
  switch (serviceError.type) {
    case 'user_invalid_credentials':
      return '邮箱或密码不正确';
    case 'user_already_exists':
      return '该邮箱已注册，请直接登录或使用邮箱验证码';
    case 'general_rate_limit_exceeded':
      return '操作过于频繁，请稍后再试';
    case 'user_session_already_exists':
      return '当前账号已登录，请刷新页面';
  }

  if (/verified email|邮箱尚未完成验证/i.test(serviceError.message ?? '')) {
    return '邮箱尚未完成验证，请使用邮箱验证码登录';
  }
  return errorMessage(error, fallback);
}
