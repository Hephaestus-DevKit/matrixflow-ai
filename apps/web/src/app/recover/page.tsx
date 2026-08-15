'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, KeyRound, Loader2, Mail } from 'lucide-react';
import { AuthMessage, AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-store';
import { authErrorMessage } from '@/lib/errors';
import { useLocale } from '@/lib/i18n';

export default function RecoverPage() {
  const { t, locale } = useLocale();
  const { requestPasswordRecovery, resetPassword, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [userId, setUserId] = useState('');
  const [secret, setSecret] = useState('');
  const [sent, setSent] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUserId(params.get('userId') || '');
    setSecret(params.get('secret') || '');
  }, []);

  const isReset = Boolean(userId && secret);

  async function handleRequest(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await requestPasswordRecovery(email.trim());
      setSent(true);
    } catch (cause) {
      setError(authErrorMessage(cause, t('common.dataLoadFailed'), locale));
    }
  }

  async function handleReset(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setError(t('auth.recoveryMismatch'));
      return;
    }
    if (password.length < 8) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    setError('');
    try {
      await resetPassword(userId, secret, password);
      setUpdated(true);
    } catch (cause) {
      setError(authErrorMessage(cause, t('common.dataLoadFailed'), locale));
    }
  }

  return (
    <AuthShell
      title={t('auth.recoveryTitle')}
      description={t('auth.recoveryDescription')}
      step={isReset ? t('auth.recoverySubmit') : t('auth.passwordHelp')}
      footer={
        <Link href="/login" className="font-bold text-primary hover:underline">
          {t('auth.recoveryBack')}
        </Link>
      }
    >
      {updated ? (
        <div className="space-y-5">
          <AuthMessage tone="success">
            <span className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4" /> {t('auth.recoveryUpdated')}
            </span>
          </AuthMessage>
          <Button asChild className="h-11 w-full rounded-xl">
            <Link href="/login">{t('auth.recoveryBack')}</Link>
          </Button>
        </div>
      ) : isReset ? (
        <form onSubmit={handleReset} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recovery-password">{t('auth.recoveryPassword')}</Label>
            <Input
              id="recovery-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="h-11 rounded-xl bg-background/70"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recovery-confirm">{t('auth.recoveryConfirm')}</Label>
            <Input
              id="recovery-confirm"
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="h-11 rounded-xl bg-background/70"
            />
          </div>
          {error && <AuthMessage>{error}</AuthMessage>}
          <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            {t('auth.recoverySubmit')}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleRequest} className="space-y-4">
          {sent && <AuthMessage tone="success">{t('auth.recoveryEmailSent')}</AuthMessage>}
          <div className="space-y-2">
            <Label htmlFor="recovery-email">{t('auth.email')}</Label>
            <Input
              id="recovery-email"
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {t('auth.recoverySend')}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
