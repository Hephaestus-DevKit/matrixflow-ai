import type { Metadata } from 'next';
import { getServerLocale, localizedMetadata } from '@/lib/server-locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return {
    ...localizedMetadata(locale, 'invite', 'MatrixFlow AI 团队邀请'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
