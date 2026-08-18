'use client';

import Link from 'next/link';
import { Check, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale, type Locale } from '@/lib/i18n';

const COPY: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    description: string;
    notice: string;
    open: string;
    waitlist: string;
    month: string;
    start: string;
    waitlistAction: string;
    plans: Array<{ name: string; description: string; features: string[] }>;
  }
> = {
  'zh-CN': {
    eyebrow: '定价',
    title: '从可验证的免费版本开始',
    description: '当前仅开放 Free 测试版。付费套餐用于规划和候补，不会在支付服务上线前产生扣款。',
    notice:
      'AI 功能需要项目管理员先在 Appwrite Function 中配置受支持的模型密钥；未配置时产品会明确显示不可用状态。',
    open: '已开放',
    waitlist: '候补',
    month: '/月',
    start: '免费开始',
    waitlistAction: '进入测试版并等待开放',
    plans: [
      {
        name: 'Free',
        description: '用于个人验证核心工作流',
        features: ['1 个团队席位', '100 次 AI 调用/月', '3 个工作流', '1 个知识库'],
      },
      {
        name: 'Pro',
        description: '面向稳定内容生产的小团队',
        features: ['5 个团队席位', '5,000 次 AI 调用/月', '100 个工作流', '优先任务队列'],
      },
      {
        name: 'Team',
        description: '面向多角色协作的业务团队',
        features: ['20 个团队席位', '25,000 次 AI 调用/月', '500 个工作流', '审计与高级权限'],
      },
    ],
  },
  'zh-TW': {
    eyebrow: '定價',
    title: '從可驗證的免費版本開始',
    description: '目前僅開放 Free 測試版。付費方案用於規劃與候補，支付服務上線前不會產生扣款。',
    notice:
      'AI 功能需要專案管理員先在 Appwrite Function 設定支援的模型金鑰；未設定時產品會清楚顯示不可用狀態。',
    open: '已開放',
    waitlist: '候補',
    month: '/月',
    start: '免費開始',
    waitlistAction: '進入測試版並等待開放',
    plans: [
      {
        name: 'Free',
        description: '用於個人驗證核心工作流',
        features: ['1 個團隊席位', '每月 100 次 AI 呼叫', '3 個工作流', '1 個知識庫'],
      },
      {
        name: 'Pro',
        description: '面向穩定內容生產的小團隊',
        features: ['5 個團隊席位', '每月 5,000 次 AI 呼叫', '100 個工作流', '優先任務佇列'],
      },
      {
        name: 'Team',
        description: '面向多角色協作的業務團隊',
        features: ['20 個團隊席位', '每月 25,000 次 AI 呼叫', '500 個工作流', '稽核與進階權限'],
      },
    ],
  },
  en: {
    eyebrow: 'Pricing',
    title: 'Start with a verifiable free plan',
    description:
      'The Free preview is available today. Paid plans are for planning and waitlist only; no charge is made before checkout launches.',
    notice:
      'AI features require an administrator to configure a supported model key in the Appwrite Function. Unconfigured services are shown as unavailable.',
    open: 'Available',
    waitlist: 'Waitlist',
    month: '/mo',
    start: 'Start free',
    waitlistAction: 'Enter preview and join waitlist',
    plans: [
      {
        name: 'Free',
        description: 'For validating the core workflow solo',
        features: ['1 team seat', '100 AI calls / month', '3 workflows', '1 knowledge base'],
      },
      {
        name: 'Pro',
        description: 'For small teams producing content consistently',
        features: ['5 team seats', '5,000 AI calls / month', '100 workflows', 'Priority queue'],
      },
      {
        name: 'Team',
        description: 'For multi-role operating teams',
        features: [
          '20 team seats',
          '25,000 AI calls / month',
          '500 workflows',
          'Audit logs and advanced permissions',
        ],
      },
    ],
  },
};

const PRICES = ['$0', '$29', '$99'];

export function PricingContent() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  return (
    <main id="main-content" className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{copy.eyebrow}</p>
        <h1 className="font-display mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
          {copy.title}
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">
          {copy.description}
        </p>
      </div>
      <div className="mt-8 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.07] p-4 text-sm text-amber-800 dark:text-amber-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>{copy.notice}</p>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {copy.plans.map((plan, index) => {
          const available = index === 0;
          return (
            <section
              key={plan.name}
              className={`surface-card flex flex-col p-6 ${plan.name === 'Pro' ? 'border-primary/35' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold">{plan.name}</h2>
                <span className="rounded-full bg-muted px-2.5 py-1 text-2xs font-bold text-muted-foreground">
                  {available ? copy.open : copy.waitlist}
                </span>
              </div>
              <p className="font-display mt-4 text-4xl font-semibold tracking-[-0.03em]">
                {PRICES[index]}
                <span className="text-sm font-medium text-muted-foreground">{copy.month}</span>
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
              <Button
                asChild
                className="mt-8 h-auto min-h-10 w-full whitespace-normal px-3 py-2 text-center leading-5"
                variant={available ? 'default' : 'outline'}
              >
                <Link href={available ? '/register' : `/register?plan=${plan.name.toLowerCase()}`}>
                  {available ? copy.start : copy.waitlistAction}
                </Link>
              </Button>
            </section>
          );
        })}
      </div>
    </main>
  );
}
