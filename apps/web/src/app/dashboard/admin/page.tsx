'use client';

import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-store';
import { EmptyState } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/page';
import { useLocale, type Locale } from '@/lib/i18n';

const COPY: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    description: string;
    rebuilding: string;
    denied: string;
    rebuildingDescription: string;
    deniedDescription: string;
  }
> = {
  'zh-CN': {
    eyebrow: '安全管理',
    title: '团队管理后台',
    description: '管理能力将只通过服务端角色校验与不可修改审计日志开放。',
    rebuilding: '管理模块正在安全重构中',
    denied: '当前角色无权访问管理模块',
    rebuildingDescription: '收入、模型成本与模板审核会在可信计费和市场交易闭环完成后开放。',
    deniedDescription: '请联系团队所有者或管理员调整成员角色。',
  },
  'zh-TW': {
    eyebrow: '安全管理',
    title: '團隊管理後台',
    description: '管理能力只會透過伺服器角色驗證與不可修改的稽核記錄開放。',
    rebuilding: '管理模組正在安全重構中',
    denied: '目前角色無權存取管理模組',
    rebuildingDescription: '收入、模型成本與模板審核會在可信計費與市場交易閉環完成後開放。',
    deniedDescription: '請聯絡團隊擁有者或管理員調整成員角色。',
  },
  en: {
    eyebrow: 'Security admin',
    title: 'Team administration',
    description:
      'Administrative capabilities open only behind server-side role checks and immutable audit logs.',
    rebuilding: 'Admin module is being rebuilt safely',
    denied: 'Your role cannot access administration',
    rebuildingDescription:
      'Revenue, model cost, and template review will open after trusted billing and marketplace loops are complete.',
    deniedDescription: 'Ask the team owner or an administrator to adjust your role.',
  },
};

export default function AdminPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const { hasPerm } = useAuth();
  const allowed = hasPerm('admin.manage');

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      <EmptyState
        icon={ShieldCheck}
        title={allowed ? copy.rebuilding : copy.denied}
        description={allowed ? copy.rebuildingDescription : copy.deniedDescription}
      />
    </div>
  );
}
