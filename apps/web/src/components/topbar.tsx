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
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-xl transition-colors duration-300">
      <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        AI 员工操作系统
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

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{user?.name}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1"
          >
            <LogOut className="h-3 w-3" />
            退出
          </Button>
        </div>
      </div>
    </header>
  );
}
