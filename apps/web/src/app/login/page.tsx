'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Send, CheckCircle2, Lock, Mail, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [loginMode, setLoginMode] = useState<'otp' | 'password'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'info' | 'otp'>('info');
  const [userId, setUserId] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');

  const { login, sendOtp, verifyOtp, loading } = useAuth();
  const router = useRouter();

  // Countdown timer logic
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  async function handleSendOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!email.trim()) return;
    setError('');
    try {
      const uid = await sendOtp(email);
      setUserId(uid);
      setStep('otp');
      setCountdown(60);
    } catch (err: any) {
      setError(err.message ?? '发送验证码失败，请重试');
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otpCode.trim() || !userId) return;
    setError('');
    try {
      await verifyOtp(userId, otpCode);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message ?? '验证码错误或已失效');
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message ?? '登录失败，请检查账号和密码');
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 bg-background overflow-hidden selection:bg-primary/20">
      {/* Background Gradients */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      <div className="absolute top-0 left-0 w-full h-full opacity-5 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]" />

      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3 w-3" /> 返回首页
      </Link>

      <div className="w-full max-w-[400px] space-y-6 rounded-2xl border border-border/80 bg-card/60 p-8 shadow-dark backdrop-blur-md transition-all duration-300">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-glow-sm mb-4">
            M
          </div>
          <h1 className="text-xl font-bold tracking-tight">登录 MatrixFlow AI</h1>
          <p className="mt-1.5 text-xs text-muted-foreground">欢迎使用跨境电商 AI 员工操作系统</p>
        </div>

        {loginMode === 'otp' ? (
          /* OTP Login Form */
          step === 'info' ? (
            /* OTP Step 1: Input Email */
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold">
                  邮箱
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="bg-muted/30 focus-visible:ring-primary/40 border-border/60"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full shadow-glow-sm hover:shadow-glow gap-1.5"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {loading ? '正在发送验证码...' : '获取邮箱验证码'}
              </Button>
            </form>
          ) : (
            /* OTP Step 2: Input Verification Code */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="rounded-xl bg-primary/5 border border-primary/10 p-3 space-y-1 mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" /> 验证码已发送
                </div>
                <p className="text-2xs text-muted-foreground leading-normal">
                  已向 <span className="text-foreground font-semibold">{email}</span>{' '}
                  发送了登录验证码。
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="otpCode" className="text-xs font-semibold">
                    6位邮箱验证码
                  </Label>
                  <button
                    type="button"
                    onClick={() => setStep('info')}
                    className="text-2xs text-primary hover:underline font-medium"
                  >
                    修改邮箱
                  </button>
                </div>
                <Input
                  id="otpCode"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  required
                  placeholder="输入 6 位验证码"
                  maxLength={6}
                  className="bg-muted/30 focus-visible:ring-primary/40 border-border/60 text-center tracking-widest font-mono text-base font-bold"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full shadow-glow-sm hover:shadow-glow"
                disabled={loading}
              >
                {loading ? '正在验证登录...' : '验证并登录'}
              </Button>

              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-2xs text-muted-foreground">重新获取验证码 ({countdown}s)</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    className="text-2xs text-primary hover:underline font-medium"
                  >
                    重新发送验证码
                  </button>
                )}
              </div>
            </form>
          )
        ) : (
          /* Password Login Form */
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold">
                邮箱
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="bg-muted/30 focus-visible:ring-primary/40 border-border/60"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold">
                  密码
                </Label>
                <Link href="#" className="text-2xs text-primary hover:underline">
                  忘记密码？
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="bg-muted/30 focus-visible:ring-primary/40 border-border/60"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full shadow-glow-sm hover:shadow-glow"
              disabled={loading}
            >
              {loading ? '正在验证凭证...' : '立即登录'}
            </Button>
          </form>
        )}

        {/* Toggle Mode Button */}
        <div className="text-center pt-2">
          {loginMode === 'otp' ? (
            <button
              type="button"
              onClick={() => {
                setLoginMode('password');
                setError('');
              }}
              className="text-2xs font-semibold text-primary hover:underline flex items-center gap-1 mx-auto"
            >
              <Lock className="h-3 w-3" /> 使用密码登录
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setLoginMode('otp');
                setStep('info');
                setError('');
              }}
              className="text-2xs font-semibold text-primary hover:underline flex items-center gap-1 mx-auto"
            >
              <Mail className="h-3 w-3" /> 使用邮箱验证码登录
            </button>
          )}
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center text-2xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">或者</span>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          还没有账号？{' '}
          <Link href="/register" className="text-primary hover:underline font-medium">
            免费注册
          </Link>
        </p>
      </div>
    </div>
  );
}
