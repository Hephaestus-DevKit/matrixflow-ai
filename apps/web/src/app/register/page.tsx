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
      setError('密码长度至少为 8 位');
      return;
    }
    setError('');
    try {
      const uid = await registerWithOtp(email.trim(), password, name.trim());
      setUserId(uid);
      setStep('otp');
      setCountdown(60);
    } catch (cause) {
      setError(authErrorMessage(cause, '注册失败，请稍后重试'));
    }
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    if (!otpCode.trim() || !userId) return;
    setError('');
    try {
      await verifyOtp(userId, otpCode.trim(), name.trim());
      router.replace('/dashboard');
    } catch (cause) {
      setError(authErrorMessage(cause, '验证码不正确或已失效'));
    }
  }

  return (
    <AuthShell
      title={step === 'info' ? '创建你的 AI 团队' : '验证工作邮箱'}
      description={
        step === 'info'
          ? '填写基础资料，邮箱验证完成后即可进入工作台。'
          : '输入邮件中的 6 位验证码，完成账号绑定与首次登录。'
      }
      step={step === 'info' ? '免费开始 · 第 1 步' : '邮箱验证 · 第 2 步'}
      footer={
        <>
          已有账号？{' '}
          <Link href="/login" className="font-bold text-primary hover:underline">
            直接登录
          </Link>
        </>
      }
    >
      {step === 'info' ? (
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="register-name">姓名</Label>
            <Input
              id="register-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoComplete="name"
              placeholder="Alex Wang"
              className="h-11 rounded-xl bg-background/70"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-email">工作邮箱</Label>
            <Input
              id="register-email"
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
              <Label htmlFor="register-password">账号密码</Label>
              <span className="text-2xs text-muted-foreground">至少 8 位</span>
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
                placeholder="设置安全密码"
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

          <AuthMessage tone="info">已注册但未完成验证？继续使用同一邮箱即可恢复验证。</AuthMessage>
          <label className="flex items-start gap-2.5 text-xs leading-5 text-muted-foreground">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              required
              className="mt-1 h-4 w-4 rounded border-input accent-primary"
            />
            <span>
              我已阅读并同意{' '}
              <Link
                href="/terms"
                target="_blank"
                className="font-semibold text-primary hover:underline"
              >
                服务条款
              </Link>{' '}
              与{' '}
              <Link
                href="/privacy"
                target="_blank"
                className="font-semibold text-primary hover:underline"
              >
                隐私政策
              </Link>
              。
            </span>
          </label>
          {error && <AuthMessage>{error}</AuthMessage>}

          <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading || !accepted}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {loading ? '正在创建账号...' : '发送邮箱验证码'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          <AuthMessage tone="success">
            <span className="font-semibold">验证码已发送至 {email}</span>
          </AuthMessage>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="register-otp">6 位验证码</Label>
              <button
                type="button"
                onClick={() => {
                  setStep('info');
                  setOtpCode('');
                  setError('');
                }}
                className="text-2xs font-semibold text-primary hover:underline"
              >
                修改资料
              </button>
            </div>
            <Input
              id="register-otp"
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
            {loading ? '正在验证并创建工作区...' : '验证并进入工作台'}
          </Button>
          <div className="text-center text-2xs text-muted-foreground">
            {countdown > 0 ? (
              `${countdown} 秒后可重新发送`
            ) : (
              <button
                type="button"
                onClick={() => handleRegister()}
                className="font-bold text-primary hover:underline"
              >
                重新发送验证码
              </button>
            )}
          </div>
        </form>
      )}

      <div className="mt-5 flex items-center justify-center gap-2 border-t border-border/60 pt-5 text-2xs text-muted-foreground">
        <UserPlus className="h-3.5 w-3.5 text-primary" /> 验证成功后自动创建默认组织
      </div>
    </AuthShell>
  );
}
