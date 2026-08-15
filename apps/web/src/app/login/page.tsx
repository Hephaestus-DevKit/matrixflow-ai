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
import { useLocale } from '@/lib/i18n';

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
  const { t, locale } = useLocale();
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
      setError(authErrorMessage(cause, '登录失败，请检查账号状态', locale));
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
      setError(authErrorMessage(cause, '验证码发送失败，请稍后重试', locale));
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
      setError(authErrorMessage(cause, '验证码错误或已失效', locale));
    }
  }

  return (
    <AuthShell
      title={t('auth.welcomeBack')}
      description={t('auth.loginDescription')}
      step={step === 'otp' ? t('auth.verifyStep') : t('auth.loginStep')}
      footer={
        <>
          {t('auth.noAccount')}{' '}
          <Link href="/register" className="font-bold text-primary hover:underline">
            {t('auth.freeRegister')}
          </Link>
        </>
      }
    >
      <div
        className="mb-6 grid grid-cols-2 rounded-xl bg-muted/70 p-1"
        aria-label={t('auth.loginMethods')}
      >
        {(
          [
            ['password', Lock, t('auth.passwordLogin')],
            ['otp', Mail, t('auth.otpLogin')],
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
            <Label htmlFor="login-email">{t('auth.email')}</Label>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder={t('auth.emailPlaceholder')}
              className="h-11 rounded-xl bg-background/70"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="login-password">{t('auth.password')}</Label>
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/recover';
                }}
                className="text-2xs font-semibold text-primary hover:underline"
              >
                {t('auth.passwordHelp')}
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
                placeholder={t('auth.passwordPlaceholder')}
                className="h-11 rounded-xl bg-background/70 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
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
            {loading ? t('auth.loadingLogin') : t('auth.enterWorkspace')}
          </Button>
        </form>
      ) : step === 'info' ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <AuthMessage tone="info">{t('auth.otpInfoLogin')}</AuthMessage>
          <div className="space-y-2">
            <Label htmlFor="otp-email">{t('auth.email')}</Label>
            <Input
              id="otp-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder={t('auth.emailPlaceholder')}
              className="h-11 rounded-xl bg-background/70"
            />
          </div>
          {error && <AuthMessage>{error}</AuthMessage>}
          <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {loading ? t('auth.loadingSend') : t('auth.sendOtp')}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <AuthMessage tone="success">
            <span className="font-semibold">
              {t('auth.otpSent')} {email}
            </span>
          </AuthMessage>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="otp-code">{t('auth.otpLabel')}</Label>
              <button
                type="button"
                onClick={() => setStep('info')}
                className="text-2xs font-semibold text-primary hover:underline"
              >
                {t('auth.changeEmail')}
              </button>
            </div>
            <Input
              id="otp-code"
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={t('auth.otpPlaceholder')}
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
            {loading ? t('auth.loadingVerify') : t('auth.verifyAndEnter')}
          </Button>
          <div className="text-center text-2xs text-muted-foreground">
            {countdown > 0 ? (
              `${countdown} ${t('auth.secondsRemaining')}`
            ) : (
              <button
                type="button"
                onClick={() => handleSendOtp()}
                className="font-bold text-primary hover:underline"
              >
                {t('auth.resend')}
              </button>
            )}
          </div>
        </form>
      )}
    </AuthShell>
  );
}
