import type { Metadata } from 'next';
import { TermsContent } from '@/components/legal-content';
import { getServerLocale, localizedMetadata } from '@/lib/server-locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return {
    ...localizedMetadata(locale, 'terms', 'MatrixFlow AI 服务条款'),
    alternates: { canonical: '/terms' },
  };
}

export default function TermsPage() {
  return <TermsContent />;
}
