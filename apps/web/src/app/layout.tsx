import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: { default: 'MatrixFlow AI — AI 员工操作系统', template: '%s | MatrixFlow AI' },
  description:
    '给中小企业雇一整支 AI 团队。跨境电商 AI 内容工厂 + AI 员工工作台 + 工作流 + 模板市场。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
