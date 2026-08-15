import type { Metadata } from 'next';
import { PrivacyContent } from '@/components/legal-content';

export const metadata: Metadata = {
  title: '隐私政策',
  description: 'MatrixFlow AI 隐私政策',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
