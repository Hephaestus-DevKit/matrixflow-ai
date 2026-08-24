'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Eye, EyeOff, Loader2, Send, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth-store';
import { authErrorMessage } from '@/lib/errors';
import { AuthMessage, AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/lib/i18n';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'info' | 'otp'>('info');
  const [userId, setUserId] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);

  const { registerWithOtp, verifyOtp, loading } = useAuth();
  const { t, locale } = useLocale();
  const router = useRouter();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => setCountdown((value) => value - 1), 1_000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  async function handleRegister(event?: React.FormEvent) {
    event?.preventDefault();
    if (!email.trim() || !name.trim() || !password || !accepted) return;
    if (password.length < 8) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    setError('');
    try {
      const uid = await registerWithOtp(email.trim(), password, name.trim());
      setUserId(uid);
      setStep('otp');
      setCountdown(60);
    } catch (cause) {
      setError(authErrorMessage(cause, t('auth.registerFailed'), locale));
    }
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    if (!otpCode.trim() || !userId) return;
    setError('');
    try {
      await verifyOtp(userId, otpCode.trim(), name.trim());
      router.replace(getPostRegistrationPath());
    } catch (cause) {
      setError(authErrorMessage(cause, t('auth.otpVerifyFailed'), locale));
    }
  }

  return (
    <AuthShell
      title={step === 'info' ? t('auth.registerTitle') : t('auth.verifyStep')}
      description={step === 'info' ? t('auth.registerDescription') : t('auth.verifyDescription')}
      step={step === 'info' ? t('auth.registerStep') : t('auth.verifyStep')}
      footer={
        <>
          {t('auth.haveAccount')}{' '}
          <Link href="/login" className="auth-action-link font-bold">
            {t('public.login')}
          </Link>
        </>
      }
    >
      {step === 'info' ? (
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="register-name">{t('auth.name')}</Label>
            <Input
              id="register-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoComplete="name"
              placeholder={t('auth.name')}
              className="auth-input h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-email">{t('auth.email')}</Label>
            <Input
              id="register-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder={t('auth.emailPlaceholder')}
              className="auth-input h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="register-password">{t('auth.password')}</Label>
              <span className="text-right text-xs text-muted-foreground">
                {t('auth.passwordHint')}
              </span>
            </div>
            <div className="relative">
              <Input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder={t('auth.passwordPlaceholder')}
                className="auth-input h-11 rounded-xl pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <AuthMessage tone="info">{t('auth.otpInfoRegister')}</AuthMessage>
          <label className="flex min-h-10 cursor-pointer items-start gap-2.5 py-1 text-xs leading-5 text-muted-foreground">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              required
              className="mt-1 h-4 w-4 rounded border-input accent-primary"
            />
            <span>
              {t('auth.agreementPrefix')}{' '}
              <Link href="/terms" target="_blank" rel="noreferrer" className="auth-action-link">
                {t('public.terms')}
              </Link>{' '}
              {t('auth.and')}{' '}
              <Link href="/privacy" target="_blank" rel="noreferrer" className="auth-action-link">
                {t('public.privacy')}
              </Link>
            </span>
          </label>
          {error && <AuthMessage>{error}</AuthMessage>}

          <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading || !accepted}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {loading ? t('auth.loadingRegister') : t('auth.sendOtp')}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          <AuthMessage tone="success">
            <span className="font-semibold">
              {t('auth.otpSent')} {email}
            </span>
          </AuthMessage>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="register-otp">{t('auth.otpLabel')}</Label>
              <button
                type="button"
                onClick={() => {
                  setStep('info');
                  setOtpCode('');
                  setError('');
                }}
                className="auth-action-link text-xs"
              >
                {t('auth.changeDetails')}
              </button>
            </div>
            <Input
              id="register-otp"
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={t('auth.otpPlaceholder')}
              className="auth-input h-12 rounded-xl text-center font-mono text-lg font-semibold tracking-[0.35em]"
            />
          </div>
          {error && <AuthMessage>{error}</AuthMessage>}
          <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {loading ? t('auth.loadingRegisterVerify') : t('auth.verifyAndEnter')}
          </Button>
          <div className="text-center text-xs text-muted-foreground">
            {countdown > 0 ? (
              `${countdown} ${t('auth.secondsRemaining')}`
            ) : (
              <button
                type="button"
                onClick={() => handleRegister()}
                className="auth-action-link font-bold"
              >
                {t('auth.resend')}
              </button>
            )}
          </div>
        </form>
      )}

      <div className="mt-5 flex items-center justify-center gap-2 border-t border-border/60 pt-5 text-xs text-muted-foreground">
        <UserPlus className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        {t('auth.defaultOrg')}
      </div>
    </AuthShell>
  );
}

function getPostRegistrationPath():
  '/dashboard' | '/dashboard/billing?plan=pro' | '/dashboard/billing?plan=team' {
  const requestedPlan = new URLSearchParams(window.location.search).get('plan');
  if (requestedPlan === 'pro') return '/dashboard/billing?plan=pro';
  if (requestedPlan === 'team') return '/dashboard/billing?plan=team';
  return '/dashboard';
}
