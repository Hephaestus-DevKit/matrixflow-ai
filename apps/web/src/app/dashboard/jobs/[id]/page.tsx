'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { JobProgress } from '@/components/job-progress';
import { PageHeader } from '@/components/ui/page';
import { useLocale } from '@/lib/i18n';

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { locale } = useLocale();
  const copy = {
    'zh-CN': { title: '任务详情', back: '返回任务中心' },
    'zh-TW': { title: '任務詳情', back: '返回任務中心' },
    en: { title: 'Task details', back: 'Back to task center' },
  }[locale];
  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/dashboard/jobs" className="text-sm text-primary hover:underline">
        ← {copy.back}
      </Link>
      <PageHeader title={copy.title} description={id} />
      <JobProgress jobId={id} />
    </div>
  );
}
