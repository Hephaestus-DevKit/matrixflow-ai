import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Bot, Factory, Library, GitFork, MessageSquare, Store, ArrowRight, Sparkles } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-primary/20">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight hover:opacity-90 transition-opacity">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-glow-sm">
              M
            </div>
            <span className="text-base font-bold">MatrixFlow AI</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-sm font-medium">
                登录
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="text-sm font-medium shadow-glow-sm hover:shadow-glow">
                免费开始
              </Button>
            </Link>
          </div>
        </div>
      </nav>

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
            为您的跨境团队配备<br />
            <span className="bg-gradient-to-r from-primary via-indigo-400 to-primary/80 bg-clip-text text-transparent">
              全能型 AI 员工
            </span>
          </h1>
          <p className="mb-10 text-base text-muted-foreground sm:text-lg max-w-2xl mx-auto leading-relaxed">
            导入商品资料，30 秒自动生成高转化标题、专业 Listing 详情页、社媒引流脚本、精准广告文案与多语言译本，一键同步上架。
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/register">
              <Button size="lg" className="gap-2 text-sm font-semibold shadow-glow hover:shadow-glow-lg transition-all duration-200">
                免费开始体验 <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href={"/demo" as any}>
              <Button variant="outline" size="lg" className="text-sm font-semibold border-border hover:bg-muted/50 transition-colors">
                观看演示视频
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border/40 bg-muted/10 px-4 py-24 relative">
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
              { icon: Bot, title: 'AI 员工系统', desc: '灵活定制文案、客服、数据分析等专属角色，自由赋予业务技能与私有知识库。' },
              { icon: Factory, title: '内容工厂', desc: '一键输出 15 类跨境出海高质量文案：覆盖产品 Listing、广告语、红人脚本等。' },
              { icon: Library, title: '智能知识库 / RAG', desc: '无缝学习产品白皮书、FAQ 问答与品牌调性，确保 AI 输出内容精确且符合品牌调性。' },
              { icon: GitFork, title: '可视化工作流', desc: '拖拽式流程编排，集成 AI 决策、逻辑条件与 Webhook 节点，打造全自动化流转。' },
              { icon: MessageSquare, title: '智能客服 & CRM', desc: '多渠道消息自动回复、意图识别与跟进，智能分析买家画像，辅助成交转化。' },
              { icon: Store, title: '模板生态市场', desc: '开箱即用行业标杆级 AI 员工角色与业务流模板，助力团队敏捷落地。' },
            ].map((f, idx) => {
              const IconComponent = f.icon;
              return (
                <div key={idx} className="group rounded-xl border border-border/60 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md">
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors">
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2 font-semibold text-foreground group-hover:text-primary transition-colors text-base">{f.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
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
          <h2 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl">开启智能化出海新纪元</h2>
          <p className="mb-8 text-muted-foreground text-sm sm:text-base">免费赠送 100 次 AI 调用额度，无需绑定信用卡，即刻配置您的 AI 员工。</p>
          <Link href="/register">
            <Button size="lg" className="shadow-glow hover:shadow-glow-lg transition-all duration-200">
              免费注册体验
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 px-4 py-8 text-center text-xs text-muted-foreground">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>© 2026 MatrixFlow AI · 跨境电商 AI 员工操作系统 · 版权所有</span>
          <div className="flex gap-4">
            <a href="#" className="hover:text-foreground transition-colors">服务协议</a>
            <a href="#" className="hover:text-foreground transition-colors">隐私政策</a>
          </div>
        </div>
      </footer>
    </div>
  );
}