import Link from 'next/link';
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
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div
      id="main-content"
      className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-primary/20"
    >
      <PublicHeader />

      {/* Hero */}
      <section className="relative flex flex-1 flex-col items-center justify-center px-4 py-24 text-center overflow-hidden">
        {/* Decorative background grid and gradients */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-background to-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] opacity-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)]" />

        <div className="mx-auto max-w-3xl animate-fade-in relative z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary backdrop-blur-sm">
            <Sparkles className="h-3 w-3 animate-pulse" />
            跨境电商专属 · AI 员工操作系统
          </div>
          <h1 className="mb-6 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl lg:leading-tight">
            为您的跨境团队配备
            <br />
            <span className="bg-gradient-to-r from-primary via-indigo-400 to-primary/80 bg-clip-text text-transparent">
              全能型 AI 员工
            </span>
          </h1>
          <p className="mb-10 text-base text-muted-foreground sm:text-lg max-w-2xl mx-auto leading-relaxed">
            导入商品资料，在一个工作台生成 Listing、广告文案、社媒脚本与多语言译本；
            用团队知识库约束输出，并保留真实调用与运行记录。
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/register">
              <Button
                size="lg"
                className="gap-2 text-sm font-semibold shadow-glow hover:shadow-glow-lg transition-all duration-200"
              >
                免费开始体验 <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#capabilities">
              <Button
                variant="outline"
                size="lg"
                className="text-sm font-semibold border-border hover:bg-muted/50 transition-colors"
              >
                查看产品能力
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        id="capabilities"
        className="scroll-mt-16 border-t border-border/40 bg-muted/10 px-4 py-24 relative"
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
      <section className="border-t border-border/40 px-4 py-24 text-center relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_bottom,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
        <div className="relative z-10 max-w-2xl mx-auto">
          <h2 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl">
            开启智能化出海新纪元
          </h2>
          <p className="mb-8 text-muted-foreground text-sm sm:text-base">
            免费测试版包含每月 100 次 AI 调用额度；模型服务配置完成后即可开始使用。
          </p>
          <Link href="/register">
            <Button
              size="lg"
              className="shadow-glow hover:shadow-glow-lg transition-all duration-200"
            >
              免费注册体验
            </Button>
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
