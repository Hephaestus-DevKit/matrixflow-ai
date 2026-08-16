import type { Metadata } from 'next';
import { getServerLocale, localizedMetadata } from '@/lib/server-locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return {
    ...localizedMetadata(locale, 'register', '创建你的 MatrixFlow AI 团队'),
    robots: { index: false, follow: false },
  };
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
