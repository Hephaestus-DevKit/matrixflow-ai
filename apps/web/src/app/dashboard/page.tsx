'use client';

import { useAuth } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';
import { Bot, Factory, Zap, FolderOpen, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: agents } = useQuery({ queryKey: ['agents'], queryFn: () => apiClient.get('/agents'), enabled: !!user });
  const { data: projects } = useQuery({ queryKey: ['content-projects'], queryFn: () => apiClient.get('/content/projects'), enabled: !!user });

  const agentCount = Array.isArray(agents) ? agents.length : 0;
  const projectCount = Array.isArray(projects) ? projects.length : 0;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">欢迎回来，{user?.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            您的专属跨境 AI 运营团队正在后台高效运行中
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: '活跃 AI 员工', value: agentCount, icon: Bot, color: 'text-primary', bg: 'bg-primary/5' },
          { label: '内容工厂项目', value: projectCount, icon: Factory, color: 'text-success', bg: 'bg-success/5' },
          { label: '本月 AI 调用', value: '—', icon: Zap, color: 'text-warning', bg: 'bg-warning/5' },
          { label: '关联知识库', value: '—', icon: FolderOpen, color: 'text-primary', bg: 'bg-primary/5' },
        ].map((s, idx) => {
          const Icon = s.icon;
          return (
            <div key={idx} className="rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-all hover:border-border hover:shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</span>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.bg}`}>
                  <Icon className={`h-4.5 w-4.5 ${s.color}`} />
                </div>
              </div>
              <p className="mt-4 text-3xl font-bold tracking-tight text-foreground">{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h2 className="text-base font-bold tracking-tight">快捷入口</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Link
            href="/dashboard/content/new"
            className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors">
              <Factory className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-bold text-foreground group-hover:text-primary transition-colors text-sm flex items-center gap-1.5">
              新建内容项目 <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
            </h3>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              导入商品细节，一键批量产出标题、Listing 描述、TikTok 脚本等 15 种文案。
            </p>
          </Link>

          <Link
            href="/dashboard/agents/new"
            className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors">
              <Bot className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-bold text-foreground group-hover:text-primary transition-colors text-sm flex items-center gap-1.5">
              配置 AI 员工 <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
            </h3>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              从行业标杆模板库快速创建客服、文案策划、竞品分析或SEO优化员工。
            </p>
          </Link>

          <Link
            href="/dashboard/knowledge/new"
            className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors">
              <FolderOpen className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-bold text-foreground group-hover:text-primary transition-colors text-sm flex items-center gap-1.5">
              新建知识库 <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
            </h3>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              上传私域商品资料、历史邮件或客服Q&A，赋能 AI 员工以实现精确回答。
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
