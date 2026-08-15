import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { SkipLink } from '@/components/skip-link';

export const metadata: Metadata = {
  metadataBase: new URL('https://matrixflow-ai.vercel.app'),
  applicationName: 'MatrixFlow AI',
  title: { default: 'MatrixFlow AI — AI 员工操作系统', template: '%s | MatrixFlow AI' },
  description: '面向跨境团队的 AI 内容、知识库、AI 员工与可追踪工作流平台。',
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: 'MatrixFlow AI',
    title: 'MatrixFlow AI — 团队 AI 运营工作台',
    description: '让内容、知识与工作流在一个安全的团队空间中协作。',
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          <SkipLink />
          {children}
          <Toaster richColors position="top-right" />
          <Analytics />
          <SpeedInsights />
        </Providers>
      </body>
    </html>
  );
}
