'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { teams } from '@/lib/appwrite';
import { Button } from '@/components/ui/button';
import { PublicFooter, PublicHeader } from '@/components/public-shell';
import { errorMessage } from '@/lib/errors';

export function InviteClient() {
  const search = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('正在验证团队邀请…');

  useEffect(() => {
    const teamId = search.get('teamId');
    const membershipId = search.get('membershipId');
    const userId = search.get('userId');
    const secret = search.get('secret');
    if (!teamId || !membershipId || !userId || !secret) {
      setStatus('error');
      setMessage('邀请链接不完整或已经失效。');
      return;
    }
    teams
      .updateMembershipStatus({ teamId, membershipId, userId, secret })
      .then(() => {
        setStatus('success');
        setMessage('已成功加入团队，可以进入工作台。');
      })
      .catch((error: unknown) => {
        setStatus('error');
        setMessage(errorMessage(error, '邀请验证失败或链接已失效。'));
      });
  }, [search]);

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
          <h1 className="mt-5 text-xl font-bold">团队邀请</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
          {status !== 'loading' && (
            <Button asChild className="mt-6">
              <Link href={status === 'success' ? '/dashboard' : '/login'}>
                {status === 'success' ? '进入工作台' : '返回登录'}
              </Link>
            </Button>
          )}
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
