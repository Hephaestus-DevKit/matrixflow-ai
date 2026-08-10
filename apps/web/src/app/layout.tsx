import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  applicationName: 'MatrixFlow AI',
  title: { default: 'MatrixFlow AI — AI 员工操作系统', template: '%s | MatrixFlow AI' },
  description:
    '给中小企业雇一整支 AI 团队。跨境电商 AI 内容工厂 + AI 员工工作台 + 工作流 + 模板市场。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="min-h-screen bg-background font-sans antialiased">
        <a
          href="#main-content"
          className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-transform focus:translate-y-0"
        >
          跳到主要内容
        </a>
        <Providers>
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
