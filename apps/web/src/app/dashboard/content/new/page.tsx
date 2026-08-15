'use client';

import { useLocale, type Locale } from '@/lib/i18n';

const COPY: Record<Locale, { title: string; description: string; action: string }> = {
  'zh-CN': {
    title: '新建内容项目',
    description: '请到内容工厂页面直接创建项目并上传商品资料。',
    action: '前往内容工厂',
  },
  'zh-TW': {
    title: '建立內容專案',
    description: '請前往內容工廠直接建立專案並上傳商品資料。',
    action: '前往內容工廠',
  },
  en: {
    title: 'Create content project',
    description:
      'Create the project and upload product material directly from the content factory.',
    action: 'Go to content factory',
  },
};

export default function NewContentProjectPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-bold">{copy.title}</h1>
      <p className="text-sm text-muted-foreground">{copy.description}</p>
      <a
        href="/dashboard/content"
        className="inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
      >
        {copy.action}
      </a>
    </div>
  );
}
