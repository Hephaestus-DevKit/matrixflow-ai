import type { Metadata } from 'next';
import { TermsContent } from '@/components/legal-content';

export const metadata: Metadata = {
  title: '服务条款',
  description: 'MatrixFlow AI 服务条款',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return <TermsContent />;
}
