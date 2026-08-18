'use client';

import Link from 'next/link';
import { ArrowRight, Factory } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';
import { useLocale, type Locale } from '@/lib/i18n';

const COPY: Record<
  Locale,
  { eyebrow: string; title: string; description: string; action: string; hint: string }
> = {
  'zh-CN': {
    eyebrow: '内容工作区',
    title: '新建内容项目',
    description: '请到内容工厂页面直接创建项目并上传商品资料。',
    action: '前往内容工厂',
    hint: '项目创建、资料上传和内容矩阵生成都集中在同一工作台完成。',
  },
  'zh-TW': {
    eyebrow: '內容工作區',
    title: '建立內容專案',
    description: '請前往內容工廠直接建立專案並上傳商品資料。',
    action: '前往內容工廠',
    hint: '專案建立、資料上傳和內容矩陣生成都集中在同一工作台完成。',
  },
  en: {
    eyebrow: 'Content workspace',
    title: 'Create content project',
    description:
      'Create the project and upload product material directly from the content factory.',
    action: 'Go to content factory',
    hint: 'Project setup, source uploads, and content-matrix generation live in one workspace.',
  },
};

export default function NewContentProjectPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      <section className="surface-card max-w-2xl p-5 sm:p-6">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
          <Factory className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">{copy.hint}</p>
        <Button asChild className="mt-5 gap-2">
          <Link href="/dashboard/content">
            {copy.action}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </section>
    </div>
  );
}
