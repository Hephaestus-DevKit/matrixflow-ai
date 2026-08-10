'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, Send } from 'lucide-react';
import { useAuth } from '@/lib/auth-store';
import { authErrorMessage } from '@/lib/errors';
import { AuthMessage, AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';

type LoginMode = 'password' | 'otp';

export default function LoginPage() {
  const [loginMode, setLoginMode] = useState<LoginMode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'info' | 'otp'>('info');
  const [userId, setUserId] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');

  const { login, sendOtp, verifyOtp, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => setCountdown((value) => value - 1), 1_000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  function changeMode(mode: LoginMode) {
    setLoginMode(mode);
    setStep('info');
    setOtpCode('');
    setUserId('');
    setError('');
  }

  async function handlePasswordLogin(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await login(email.trim(), password);
      router.replace('/dashboard');
    } catch (cause) {
      setError(authErrorMessage(cause, '登录失败，请检查账号状态'));
    }
  }

  async function handleSendOtp(event?: React.FormEvent) {
    event?.preventDefault();
    if (!email.trim()) return;
    setError('');
    try {
      const uid = await sendOtp(email.trim());
      setUserId(uid);
      setStep('otp');
      setCountdown(60);
    } catch (cause) {
      setError(authErrorMessage(cause, '验证码发送失败，请稍后重试'));
    }
  }

  async function handleVerifyOtp(event: React.FormEvent) {
    event.preventDefault();
    if (!otpCode.trim() || !userId) return;
    setError('');
    try {
      await verifyOtp(userId, otpCode.trim());
      router.replace('/dashboard');
    } catch (cause) {
      setError(authErrorMessage(cause, '验证码错误或已失效'));
    }
  }

  return (
    <AuthShell
      title="欢迎回来"
      description="验证身份后继续管理你的 AI 团队与自动化业务。"
      step={step === 'otp' ? '验证邮箱 · 第 2 步' : '安全登录'}
      footer={
        <>
          还没有账号？{' '}
          <Link href="/register" className="font-bold text-primary hover:underline">
            免费注册
          </Link>
        </>
      }
    >
      <div className="mb-6 grid grid-cols-2 rounded-xl bg-muted/70 p-1" aria-label="登录方式">
        {(
          [
            ['password', Lock, '密码登录'],
            ['otp', Mail, '邮箱验证码'],
          ] as const
        ).map(([mode, Icon, label]) => (
          <button
            key={mode}
            type="button"
            aria-pressed={loginMode === mode}
            onClick={() => changeMode(mode)}
            className={cn(
              'flex h-9 items-center justify-center gap-2 rounded-lg text-xs font-bold transition-all',
              loginMode === mode
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {loginMode === 'password' ? (
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email">邮箱</Label>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="h-11 rounded-xl bg-background/70"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="login-password">密码</Label>
              <button
                type="button"
                onClick={() => changeMode('otp')}
                className="text-2xs font-semibold text-primary hover:underline"
              >
                无法使用密码？
              </button>
            </div>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                placeholder="输入账号密码"
                className="h-11 rounded-xl bg-background/70 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && <AuthMessage>{error}</AuthMessage>}

          <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            {loading ? '正在验证并同步账号...' : '进入工作台'}
          </Button>
        </form>
      ) : step === 'info' ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <AuthMessage tone="info">验证码可用于登录，也可恢复尚未完成验证的账号。</AuthMessage>
          <div className="space-y-2">
            <Label htmlFor="otp-email">邮箱</Label>
            <Input
              id="otp-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="h-11 rounded-xl bg-background/70"
            />
          </div>
          {error && <AuthMessage>{error}</AuthMessage>}
          <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {loading ? '正在发送验证码...' : '发送邮箱验证码'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <AuthMessage tone="success">
            <span className="font-semibold">验证码已发送至 {email}</span>
          </AuthMessage>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="otp-code">6 位验证码</Label>
              <button
                type="button"
                onClick={() => setStep('info')}
                className="text-2xs font-semibold text-primary hover:underline"
              >
                修改邮箱
              </button>
            </div>
            <Input
              id="otp-code"
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="h-12 rounded-xl bg-background/70 text-center font-mono text-lg font-black tracking-[0.35em]"
            />
          </div>
          {error && <AuthMessage>{error}</AuthMessage>}
          <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {loading ? '正在验证并同步账号...' : '验证并进入工作台'}
          </Button>
          <div className="text-center text-2xs text-muted-foreground">
            {countdown > 0 ? (
              `${countdown} 秒后可重新发送`
            ) : (
              <button
                type="button"
                onClick={() => handleSendOtp()}
                className="font-bold text-primary hover:underline"
              >
                重新发送验证码
              </button>
            )}
          </div>
        </form>
      )}
    </AuthShell>
  );
}
