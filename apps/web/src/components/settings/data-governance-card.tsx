'use client';

import { useState } from 'react';
import { Download, FileKey2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { useLocale, type Locale } from '@/lib/i18n';

const COPY: Record<
  Locale,
  {
    title: string;
    description: string;
    adminOnly: string;
    export: string;
    exporting: string;
    exportSuccess: string;
    exportFailed: string;
    deleteTitle: string;
    deleteDescription: string;
    confirmLabel: string;
    confirmPlaceholder: string;
    delete: string;
    deleting: string;
    deleteConfirm: string;
    deleteSuccess: string;
    deleteFailed: string;
    cancel: string;
  }
> = {
  'zh-CN': {
    title: '数据与隐私',
    description:
      '导出组织数据，或在需要时删除业务数据。导出会自动脱敏密钥；安全审计和计费证据按保留策略留存。',
    adminOnly: '只有团队所有者或管理员可以执行组织级数据操作。',
    export: '导出数据',
    exporting: '准备导出…',
    exportSuccess: '数据导出已下载',
    exportFailed: '数据导出失败，请稍后重试',
    deleteTitle: '删除组织业务数据',
    deleteDescription: '删除不可逆。请输入组织 ID 进行确认；安全审计和计费事件不会被静默删除。',
    confirmLabel: '确认组织 ID',
    confirmPlaceholder: '输入当前组织 ID',
    delete: '永久删除',
    deleting: '删除中…',
    deleteConfirm: '此操作会删除组织业务数据且无法撤销，确定继续吗？',
    deleteSuccess: '组织业务数据已删除',
    deleteFailed: '删除失败，请联系管理员并保留返回的请求 ID',
    cancel: '取消',
  },
  'zh-TW': {
    title: '資料與隱私',
    description:
      '匯出組織資料，或在需要時刪除業務資料。匯出會自動遮罩密鑰；安全稽核與計費證據依保留策略保存。',
    adminOnly: '只有團隊擁有者或管理員可以執行組織級資料操作。',
    export: '匯出資料',
    exporting: '準備匯出…',
    exportSuccess: '資料匯出已下載',
    exportFailed: '資料匯出失敗，請稍後再試',
    deleteTitle: '刪除組織業務資料',
    deleteDescription: '刪除不可逆。請輸入組織 ID 確認；安全稽核與計費事件不會被靜默刪除。',
    confirmLabel: '確認組織 ID',
    confirmPlaceholder: '輸入目前組織 ID',
    delete: '永久刪除',
    deleting: '刪除中…',
    deleteConfirm: '此操作會刪除組織業務資料且無法撤銷，確定繼續嗎？',
    deleteSuccess: '組織業務資料已刪除',
    deleteFailed: '刪除失敗，請聯絡管理員並保留返回的請求 ID',
    cancel: '取消',
  },
  en: {
    title: 'Data & privacy',
    description:
      'Export workspace data or delete business data when needed. Exports redact secrets; security and billing evidence follow retention policy.',
    adminOnly:
      'Only workspace owners and administrators can perform organization-level data operations.',
    export: 'Export data',
    exporting: 'Preparing export…',
    exportSuccess: 'Data export downloaded',
    exportFailed: 'Could not export data. Try again later.',
    deleteTitle: 'Delete workspace business data',
    deleteDescription:
      'Deletion is irreversible. Enter the organization ID to confirm; security audit and billing events are retained by policy.',
    confirmLabel: 'Confirm organization ID',
    confirmPlaceholder: 'Enter the current organization ID',
    delete: 'Delete permanently',
    deleting: 'Deleting…',
    deleteConfirm: 'This permanently deletes workspace business data. Continue?',
    deleteSuccess: 'Workspace business data deleted',
    deleteFailed: 'Deletion failed. Contact an administrator and keep the request ID.',
    cancel: 'Cancel',
  },
};

export function DataGovernanceCard() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const { organizationId, user } = useAuth();
  const membership = user?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.role === 'owner' || membership?.role === 'admin';
  const [confirmation, setConfirmation] = useState('');
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function exportData() {
    setExporting(true);
    try {
      const data = await apiClient.get<Record<string, unknown>>('/account/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `matrixflow-export-${organizationId || 'workspace'}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(copy.exportSuccess);
    } catch {
      toast.error(copy.exportFailed);
    } finally {
      setExporting(false);
    }
  }

  function requestDelete() {
    if (!organizationId || confirmation !== organizationId) return;
    setConfirmOpen(true);
  }

  async function deleteData() {
    if (!organizationId || confirmation !== organizationId) return;
    setDeleting(true);
    try {
      await apiClient.del('/account', { confirmation, reason: 'user_requested' });
      toast.success(copy.deleteSuccess);
      setConfirmation('');
      setConfirmOpen(false);
    } catch {
      toast.error(copy.deleteFailed);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="surface-card space-y-5 p-5 sm:p-6">
      <div className="flex items-start gap-3 border-b border-border/40 pb-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileKey2 className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-foreground">{copy.title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.description}</p>
        </div>
      </div>
      {!canManage ? (
        <p className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
          {copy.adminOnly}
        </p>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => void exportData()}
            disabled={exporting}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {exporting ? copy.exporting : copy.export}
          </Button>
          <div className="rounded-xl border border-destructive/20 bg-destructive/[0.03] p-4 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-destructive">{copy.deleteTitle}</h4>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {copy.deleteDescription}
              </p>
            </div>
            <Label htmlFor="delete-organization-id" className="text-xs font-semibold">
              {copy.confirmLabel}
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="delete-organization-id"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={copy.confirmPlaceholder}
                autoComplete="off"
              />
              <Button
                type="button"
                variant="destructive"
                onClick={requestDelete}
                disabled={deleting || !organizationId || confirmation !== organizationId}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {deleting ? copy.deleting : copy.delete}
              </Button>
            </div>
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title={copy.deleteTitle}
        description={copy.deleteConfirm}
        confirmLabel={copy.delete}
        cancelLabel={copy.cancel}
        busy={deleting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void deleteData()}
      />
    </section>
  );
}
