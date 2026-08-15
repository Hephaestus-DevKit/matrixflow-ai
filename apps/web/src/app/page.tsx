import Link from 'next/link';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { PublicFooter, PublicHeader } from '@/components/public-shell';
import {
  Bot,
  Factory,
  Library,
  GitFork,
  MessageSquare,
  Store,
  ArrowRight,
  Sparkles,
  Database,
  Layers3,
  ShieldCheck,
} from 'lucide-react';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

const OPERATING_FLOW = [
  {
    icon: Database,
    step: '01',
    title: '沉淀业务上下文',
    description: '产品文档 · FAQ · 品牌语气',
  },
  {
    icon: Layers3,
    step: '02',
    title: '生成内容矩阵',
    description: 'Listing · 广告 · 社媒 · 多语言',
  },
  {
    icon: ShieldCheck,
    step: '03',
    title: '审核与追踪',
    description: '引用来源 · 调用用量 · 审计记录',
  },
] as const;

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-primary/20">
      <PublicHeader />

      <main id="main-content" className="flex-1">
        {/* Hero */}
        <section className="relative flex min-h-[calc(100svh-4rem)] items-center overflow-hidden px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-background to-background" />
          <div className="absolute left-1/2 top-0 h-[620px] w-full max-w-7xl -translate-x-1/2 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] opacity-10 [mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)]" />

          <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[minmax(0,0.94fr)_minmax(480px,1.06fr)] lg:gap-16">
            <div className="animate-fade-in text-center lg:text-left">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary backdrop-blur-sm">
                <Sparkles className="h-3 w-3 animate-pulse" aria-hidden="true" />
                跨境电商专属 · AI 员工操作系统
              </div>
              <h1 className="text-4xl font-black leading-[1.08] tracking-[-0.045em] sm:text-5xl lg:text-[3.5rem]">
                把跨境运营流程，
                <span className="mt-2 block bg-gradient-to-r from-violet-500 via-primary to-indigo-400 bg-clip-text text-transparent">
                  交给可控的 AI 团队
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8 lg:mx-0">
                导入商品资料，在一个工作台生成 Listing、广告文案、社媒脚本与多语言译本；
                用团队知识库约束输出，并保留真实调用与运行记录。
              </p>
              <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Button
                  asChild
                  size="lg"
                  className="gap-2 text-sm font-semibold shadow-glow transition-shadow duration-200 hover:shadow-glow-lg"
                >
                  <Link href="/register">
                    免费开始体验 <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-border text-sm font-semibold transition-colors hover:bg-muted/50"
                >
                  <Link href="#capabilities">查看产品能力</Link>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground lg:justify-start">
                {['组织级数据隔离', '调用过程可追踪', '未配置时安全失败'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div
              className="relative mx-auto w-full max-w-xl"
              aria-label="MatrixFlow 产品工作流预览"
            >
              <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-primary/15 blur-3xl" />
              <div className="overflow-hidden rounded-[1.75rem] border border-border/75 bg-card/80 shadow-[0_32px_100px_-42px_hsl(var(--primary)/0.65)] backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className="brand-mark h-8 w-8 rounded-lg text-xs" aria-hidden="true">
                      M
                    </span>
                    <div>
                      <p className="text-xs font-bold">运营控制台</p>
                      <p className="text-[0.6875rem] text-muted-foreground">从知识到可审核内容</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[0.6875rem] font-bold text-primary">
                    Appwrite 原生数据层
                  </span>
                </div>
                <div className="space-y-3 p-4 sm:p-5">
                  {OPERATING_FLOW.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.step}>
                        <div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-background/65 p-4">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-primary">
                              Step {item.step}
                            </p>
                            <p className="mt-0.5 text-sm font-bold">{item.title}</p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {item.description}
                            </p>
                          </div>
                          <span className="hidden rounded-full bg-muted px-2 py-1 text-[0.6875rem] font-semibold text-muted-foreground sm:block">
                            {index === 2 ? '可审核' : '已编排'}
                          </span>
                        </div>
                        {index < OPERATING_FLOW.length - 1 && (
                          <div className="ml-9 h-3 w-px bg-gradient-to-b from-primary/50 to-border" />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 border-t border-border/70 bg-muted/20 px-5 py-4 text-center">
                  {[
                    ['12 类', '内容格式'],
                    ['团队级', '权限边界'],
                    ['全链路', '运行记录'],
                  ].map(([value, label]) => (
                    <div key={label}>
                      <p className="text-sm font-black">{value}</p>
                      <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section
          id="capabilities"
          className="relative scroll-mt-16 border-t border-border/40 bg-muted/10 px-4 py-24"
        >
          <div className="mx-auto max-w-6xl relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                一个系统，即是一整支 AI 运营团队
              </h2>
              <p className="mt-4 text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
                覆盖从素材策划、内容产出、多语言客服到自动化流转的完整跨境出海链路
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Bot,
                  title: 'AI 员工系统',
                  desc: '配置文案、客服等专属角色，并通过受控运行入口查看每次调用结果与消耗。',
                },
                {
                  icon: Factory,
                  title: '内容工厂',
                  desc: '生成 12 类跨境运营内容，覆盖产品 Listing、广告语、社媒脚本与品牌语气。',
                },
                {
                  icon: Library,
                  title: '智能知识库 / RAG',
                  desc: '无缝学习产品白皮书、FAQ 问答与品牌调性，确保 AI 输出内容精确且符合品牌调性。',
                },
                {
                  icon: GitFork,
                  title: '可视化工作流',
                  desc: '拖拽编排 AI、条件和数据转换节点；外部邮件与 Webhook 连接器按配置开放。',
                },
                {
                  icon: MessageSquare,
                  title: '智能客服 & CRM',
                  desc: '集中维护客户和内部对话，生成客服回复建议；外部渠道连接仍处于产品路线图。',
                },
                {
                  icon: Store,
                  title: '模板生态市场',
                  desc: '官方模板正在受控预览，正式发布、授权与交易能力开放前不会产生扣款。',
                },
              ].map((f, idx) => {
                const IconComponent = f.icon;
                return (
                  <div
                    key={idx}
                    className="group rounded-xl border border-border/60 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md"
                  >
                    <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors">
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <h3 className="mb-2 font-semibold text-foreground group-hover:text-primary transition-colors text-base">
                      {f.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {f.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden border-t border-border/40 px-4 py-24 text-center">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_bottom,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl">
              开启智能化出海新纪元
            </h2>
            <p className="mb-8 text-muted-foreground text-sm sm:text-base">
              免费测试版包含每月 100 次 AI 调用额度；模型服务配置完成后即可开始使用。
            </p>
            <Button
              asChild
              size="lg"
              className="shadow-glow transition-shadow duration-200 hover:shadow-glow-lg"
            >
              <Link href="/register">免费注册体验</Link>
            </Button>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
