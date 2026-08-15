import type { Metadata } from 'next';
import { PublicFooter, PublicHeader } from '@/components/public-shell';
import { PricingContent } from './pricing-content';

export const metadata: Metadata = {
  title: '定价',
  description: 'MatrixFlow AI 免费测试版与候补套餐信息。',
  alternates: { canonical: '/pricing' },
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <PricingContent />
      <PublicFooter />
    </div>
  );
}
