'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Send, CheckCircle2, Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'info' | 'otp'>('info');
  const [userId, setUserId] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const { registerWithOtp, verifyOtp, loading } = useAuth();
  const router = useRouter();

  // Countdown timer logic
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  async function handleRegisterAndSendOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!email.trim() || !name.trim() || !password.trim()) return;
    if (password.length < 8) {
      setError('密码长度至少为 8 位');
      return;
    }
    setError('');
    try {
      const uid = await registerWithOtp(email, password, name);
      setUserId(uid);
      setStep('otp');
      setCountdown(60);
    } catch (err: any) {
      setError(err.message ?? '注册失败或该邮箱已被注册');
    }
  }

  async function handleVerifyAndLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!otpCode.trim() || !userId) return;
    setError('');
    try {
      await verifyOtp(userId, otpCode);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message ?? '验证码不正确或已过期');
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 bg-background overflow-hidden selection:bg-primary/20">
      {/* Background Gradients */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      <div className="absolute top-0 left-0 w-full h-full opacity-5 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]" />

      <Link href="/" className="absolute top-6 left-6 flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3 w-3" /> 返回首页
      </Link>

      <div className="w-full max-w-[400px] space-y-6 rounded-2xl border border-border/80 bg-card/60 p-8 shadow-dark backdrop-blur-md transition-all duration-300">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-glow-sm mb-4">
            M
          </div>
          <h1 className="text-xl font-bold tracking-tight">创建 MatrixFlow AI 账号</h1>
          <p className="mt-1.5 text-xs text-muted-foreground">免费开始，即刻为您配备一整支 AI 员工</p>
        </div>

        {step === 'info' ? (
          /* Step 1: Input Name, Email & Password */
          <form onSubmit={handleRegisterAndSendOtp} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold">您的姓名</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Alex Wang"
                className="bg-muted/30 focus-visible:ring-primary/40 border-border/60"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold">工作邮箱</Label>
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
              <Label htmlFor="password" className="text-xs font-semibold">账号密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="设置 8 位以上登录密码"
                minLength={8}
                className="bg-muted/30 focus-visible:ring-primary/40 border-border/60"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full shadow-glow-sm hover:shadow-glow gap-1.5" disabled={loading}>
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {loading ? '正在创建并发送验证码...' : '发送邮箱验证码'}
            </Button>
          </form>
        ) : (
          /* Step 2: Input Verification Code */
          <form onSubmit={handleVerifyAndLogin} className="space-y-4">
            <div className="rounded-xl bg-primary/5 border border-primary/10 p-3 space-y-1 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" /> 验证码已发送
              </div>
              <p className="text-2xs text-muted-foreground leading-normal">
                已向 <span className="text-foreground font-semibold">{email}</span> 发送了 6 位数字验证码，请输入以完成账号绑定。
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="otpCode" className="text-xs font-semibold">6位邮箱验证码</Label>
                <button
                  type="button"
                  onClick={() => setStep('info')}
                  className="text-2xs text-primary hover:underline font-medium"
                >
                  修改资料
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

            <Button type="submit" className="w-full shadow-glow-sm hover:shadow-glow" disabled={loading}>
              {loading ? '正在验证注册...' : '验证并注册'}
            </Button>

            <div className="text-center">
              {countdown > 0 ? (
                <p className="text-2xs text-muted-foreground">
                  重新获取验证码 ({countdown}s)
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => handleRegisterAndSendOtp()}
                  className="text-2xs text-primary hover:underline font-medium"
                >
                  重新发送验证码
                </button>
              )}
            </div>
          </form>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center text-2xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">或者</span>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          已有账号？{' '}
          <Link href="/login" className="text-primary hover:underline font-medium">
            直接登录
          </Link>
        </p>
      </div>
    </div>
  );
}
