import type { Metadata } from 'next';
import { PublicFooter, PublicHeader } from '@/components/public-shell';
import { PricingContent } from './pricing-content';
import { getServerLocale, localizedMetadata } from '@/lib/server-locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return {
    ...localizedMetadata(locale, 'pricing', 'MatrixFlow AI 免费测试版与候补套餐信息。'),
    alternates: { canonical: '/pricing' },
  };
}

export default function PricingPage() {
  return (
    <div className="pricing-page min-h-screen text-foreground">
      <PublicHeader />
      <PricingContent />
      <PublicFooter />
    </div>
  );
}
