import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { SkipLink } from '@/components/skip-link';
import { getServerLocale, pageDescription, pageTitle } from '@/lib/server-locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return {
    metadataBase: new URL('https://matrixflow-ai.vercel.app'),
    applicationName: 'MatrixFlow AI',
    title: { default: pageTitle(locale, 'root'), template: '%s | MatrixFlow AI' },
    description: pageDescription(locale, 'root'),
    openGraph: {
      type: 'website',
      locale: locale === 'en' ? 'en_US' : locale === 'zh-TW' ? 'zh_TW' : 'zh_CN',
      siteName: 'MatrixFlow AI',
      title: pageTitle(locale, 'root'),
      description: pageDescription(locale, 'root'),
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getServerLocale();
  return (
    <html lang={locale} suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers initialLocale={locale}>
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
