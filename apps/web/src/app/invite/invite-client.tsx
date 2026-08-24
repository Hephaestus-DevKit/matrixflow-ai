'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { teams } from '@/lib/appwrite';
import { Button } from '@/components/ui/button';
import { PublicFooter, PublicHeader } from '@/components/public-shell';
import { errorMessage } from '@/lib/errors';
import { useLocale, type Locale } from '@/lib/i18n';

const COPY: Record<
  Locale,
  {
    loading: string;
    invalid: string;
    success: string;
    title: string;
    enter: string;
    back: string;
    fallback: string;
    loadingLabel: string;
  }
> = {
  'zh-CN': {
    loading: '正在验证团队邀请…',
    invalid: '邀请链接不完整或已经失效。',
    success: '已成功加入团队，可以进入工作台。',
    title: '团队邀请',
    enter: '进入工作台',
    back: '返回登录',
    fallback: '邀请验证失败或链接已失效。',
    loadingLabel: '正在加载邀请',
  },
  'zh-TW': {
    loading: '正在驗證團隊邀請…',
    invalid: '邀請連結不完整或已經失效。',
    success: '已成功加入團隊，可以進入工作台。',
    title: '團隊邀請',
    enter: '進入工作台',
    back: '返回登入',
    fallback: '邀請驗證失敗或連結已失效。',
    loadingLabel: '正在載入邀請',
  },
  en: {
    loading: 'Verifying your team invitation…',
    invalid: 'This invitation link is incomplete or has expired.',
    success: 'You joined the team. You can enter the workspace now.',
    title: 'Team invitation',
    enter: 'Enter workspace',
    back: 'Back to login',
    fallback: 'Invitation verification failed or the link has expired.',
    loadingLabel: 'Loading invitation',
  },
};

export function InviteClient() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const search = useSearchParams();
  const processedRef = useRef(false);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState(copy.loading);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;
    const teamId = search.get('teamId');
    const membershipId = search.get('membershipId');
    const userId = search.get('userId');
    const secret = search.get('secret');
    // Invitation secrets are single-use URL credentials. Remove them from
    // browser history and subsequent same-origin referrers immediately after
    // reading them for the Appwrite confirmation call.
    window.history.replaceState(null, '', '/invite');
    if (!teamId || !membershipId || !userId || !secret) {
      setStatus('error');
      setMessage(copy.invalid);
      return;
    }
    teams
      .updateMembershipStatus({ teamId, membershipId, userId, secret })
      .then(() => {
        setStatus('success');
        setMessage(copy.success);
      })
      .catch((error: unknown) => {
        setStatus('error');
        setMessage(errorMessage(error, copy.fallback));
      });
  }, [copy, search]);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main
        id="main-content"
        className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4 py-16"
      >
        <section className="surface-card w-full p-8 text-center">
          {status === 'loading' ? (
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          ) : status === 'success' ? (
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
          ) : (
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
          )}
          <h1 className="mt-5 text-xl font-bold">{copy.title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
          {status !== 'loading' && (
            <Button asChild className="mt-6">
              <Link href={status === 'success' ? '/dashboard' : '/login'}>
                {status === 'success' ? copy.enter : copy.back}
              </Link>
            </Button>
          )}
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
