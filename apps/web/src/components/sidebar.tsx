'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-store';
import { cn } from '@/lib/cn';
import {
  LayoutDashboard,
  Bot,
  Factory,
  FolderOpen,
  GitFork,
  MessageSquare,
  Store,
  LineChart,
  Settings
} from 'lucide-react';

const NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: '总览' },
  { href: '/dashboard/agents', icon: Bot, label: 'AI 员工' },
  { href: '/dashboard/content', icon: Factory, label: '内容工厂' },
  { href: '/dashboard/knowledge', icon: FolderOpen, label: '知识库' },
  { href: '/dashboard/workflows', icon: GitFork, label: '工作流' },
  { href: '/dashboard/crm', icon: MessageSquare, label: 'CRM' },
  { href: '/dashboard/marketplace', icon: Store, label: '模板市场' },
  { href: '/dashboard/analytics', icon: LineChart, label: '数据看板' },
  { href: '/dashboard/settings', icon: Settings, label: '设置' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-border bg-card/90 backdrop-blur-md shadow-dark-sm">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border/80 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-primary via-indigo-500 to-primary text-primary-foreground text-xs font-black shadow-glow-sm hover:rotate-6 transition-transform duration-300">
          M
        </div>
        <span className="font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-primary bg-clip-text text-transparent text-sm">MatrixFlow AI</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href as any}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3.5 py-2 text-xs transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]',
                isActive
                  ? 'bg-primary/10 text-primary font-bold shadow-glow-sm border border-primary/20'
                  : 'text-muted-foreground hover:bg-muted/65 hover:text-foreground',
              )}
            >
              <Icon className={cn('h-4 w-4 transition-transform duration-200 group-hover:scale-105', isActive ? 'text-primary' : 'text-muted-foreground')} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-border p-3 bg-muted/20">
        <Link 
          href="/dashboard/settings" 
          className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/60 transition-all duration-200 cursor-pointer group"
          title="点击查看个人资料设置"
        >
          {user?.avatarUrl ? (
            <img 
              src={user.avatarUrl} 
              alt={user.name} 
              className="h-8 w-8 rounded-full object-cover border border-primary/20 group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20 group-hover:scale-105 transition-transform uppercase">
              {user?.name?.[0] ?? '?'}
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-xs font-bold text-foreground group-hover:text-primary transition-colors">
              {user?.name ?? '个人用户'}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">{user?.email ?? ''}</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}