'use client';

import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { Sun, Moon, LogOut } from 'lucide-react';

export function Topbar() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/60 bg-background/60 px-6 backdrop-blur-md transition-colors duration-300 shadow-xs">
      <div className="text-2xs font-extrabold tracking-widest text-muted-foreground/80 uppercase">
        AI 员工操作系统 · Dashboard
      </div>
      <div className="flex items-center gap-4">
        {/* Muted Morandi Theme Toggle */}
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all"
            title={theme === 'dark' ? '切换为莫兰迪亮色模式' : '切换为暗色模式'}
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-500 animate-pulse-glow" />
            ) : (
              <Moon className="h-4 w-4 text-slate-500" />
            )}
          </Button>
        )}

        <div className="h-4 w-px bg-border/60" />

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors cursor-pointer">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="h-5 w-5 rounded-full object-cover" />
            ) : (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px] font-black uppercase">
                {user?.name?.[0] ?? '?'}
              </div>
            )}
            <span className="text-xs font-semibold text-foreground max-w-[100px] truncate">{user?.name}</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5 rounded-lg"
          >
            <LogOut className="h-3.5 w-3.5" />
            退出
          </Button>
        </div>
      </div>
    </header>
  );
}
