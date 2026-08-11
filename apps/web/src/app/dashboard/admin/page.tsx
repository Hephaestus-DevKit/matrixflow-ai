'use client';

import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-store';
import { EmptyState } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/page';

export default function AdminPage() {
  const { hasPerm } = useAuth();
  const allowed = hasPerm('admin.manage');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="安全管理"
        title="团队管理后台"
        description="管理能力将只通过服务端角色校验与不可修改审计日志开放。"
      />
      <EmptyState
        icon={ShieldCheck}
        title={allowed ? '管理模块正在安全重构中' : '当前角色无权访问管理模块'}
        description={
          allowed
            ? '收入、模型成本与模板审核会在可信计费和市场交易闭环完成后开放。'
            : '请联系团队所有者或管理员调整成员角色。'
        }
      />
    </div>
  );
}
