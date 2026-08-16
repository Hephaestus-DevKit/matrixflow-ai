import type { Metadata } from 'next';
import { PrivacyContent } from '@/components/legal-content';
import { getServerLocale, localizedMetadata } from '@/lib/server-locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return {
    ...localizedMetadata(locale, 'privacy', 'MatrixFlow AI 隐私政策'),
    alternates: { canonical: '/privacy' },
  };
}

export default function PrivacyPage() {
  return <PrivacyContent />;
}
