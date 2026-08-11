import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicFooter, PublicHeader } from '@/components/public-shell';

export const metadata: Metadata = {
  title: '定价',
  description: 'MatrixFlow AI 免费测试版与候补套餐信息。',
};

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    description: '用于个人验证核心工作流',
    features: ['1 个团队席位', '100 次 AI 调用/月', '3 个工作流', '1 个知识库'],
    available: true,
  },
  {
    name: 'Pro',
    price: '$29',
    description: '面向稳定内容生产的小团队',
    features: ['5 个团队席位', '5,000 次 AI 调用/月', '100 个工作流', '优先任务队列'],
    available: false,
  },
  {
    name: 'Team',
    price: '$99',
    description: '面向多角色协作的业务团队',
    features: ['20 个团队席位', '25,000 次 AI 调用/月', '500 个工作流', '审计与高级权限'],
    available: false,
  },
] as const;

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Pricing</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
            从可验证的免费版本开始
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">
            当前仅开放 Free 测试版。付费套餐用于规划和候补，不会在支付服务上线前产生扣款。
          </p>
        </div>

        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.07] p-4 text-sm text-amber-800 dark:text-amber-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            AI 功能需要项目管理员先在 Appwrite Function
            中配置受支持的模型密钥；未配置时产品会明确显示不可用状态。
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PLANS.map((plan) => (
            <section
              key={plan.name}
              className={`surface-card flex flex-col p-6 ${plan.name === 'Pro' ? 'border-primary/35' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold">{plan.name}</h2>
                <span className="rounded-full bg-muted px-2.5 py-1 text-[0.6875rem] font-bold text-muted-foreground">
                  {plan.available ? '已开放' : '候补'}
                </span>
              </div>
              <p className="mt-4 text-4xl font-black tracking-tight">
                {plan.price}
                <span className="text-sm font-medium text-muted-foreground">/月</span>
              </p>
              <p className="mt-3 min-h-10 text-sm leading-5 text-muted-foreground">
                {plan.description}
              </p>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="mt-8">
                <Button className="w-full" variant={plan.available ? 'default' : 'outline'}>
                  {plan.available ? '免费开始' : '进入测试版并等待开放'}
                </Button>
              </Link>
            </section>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
