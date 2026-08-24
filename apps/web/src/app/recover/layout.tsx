import type { Metadata } from 'next';
import { getServerLocale, localizedMetadata } from '@/lib/server-locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return {
    ...localizedMetadata(locale, 'recover', 'MatrixFlow AI 重置密码'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

export default function RecoverLayout({ children }: { children: React.ReactNode }) {
  return children;
}
