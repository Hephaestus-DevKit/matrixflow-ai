'use client';
import { useId, useState, type ReactNode } from 'react';
import {
  Check,
  ChevronRight,
  Clipboard,
  Download,
  FileText,
  Save,
  TriangleAlert,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { ContentItemSummary, SavedContentReview } from '@matrixflow/shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLocale } from '@/lib/i18n';
import { ApiError, apiClient } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/errors';
import { downloadFile } from '@/lib/shopify-translations';

export type ReviewDraft = { itemId: string; text: string; reviewed: boolean; revision: number };
type Sources = NonNullable<NonNullable<ContentItemSummary['metadata']>['citations']>;
export function ContentReview({
  draft,
  onChange,
  filename,
  citations,
  item,
  projectId,
  onSaved,
  source,
  documentLayout = false,
  withReferences = false,
  subject = false,
  stale,
}: {
  draft: ReviewDraft;
  onChange: (draft: ReviewDraft) => void;
  filename: string;
  citations: Sources;
  item: ContentItemSummary;
  projectId: string;
  onSaved: () => void;
  source?: { label: string; text: string };
  documentLayout?: boolean;
  withReferences?: boolean;
  subject?: boolean;
  stale?: { message: string; recoveryAction: ReactNode };
}) {
  const { locale } = useLocale();
  const copy = {
    en: {
      edit: 'Edit draft',
      translation: 'Translation',
      approve: 'Approve draft',
      revoke: 'Revoke approval',
      reviewHint: 'Check facts and sources before approving.',
      approved: 'Approved and saved.',
      sources: 'Retrieved sources (verify each claim)',
      empty: 'Check the original product facts before approval.',
      save: 'Save draft',
      reload: 'Load saved revision',
      savedBy: 'Saved by',
      copy: 'Copy',
      download: 'Download',
      record: 'Download review record',
      saving: 'Saving…',
      unsaved: 'Unsaved changes',
      original: 'Show original',
      compare: 'Compare saved text and keep my edits',
    },
    'zh-CN': {
      edit: '编辑草稿',
      translation: '译文',
      approve: '确认审核',
      revoke: '撤回审核',
      reviewHint: '核对商品事实与来源后确认审核。',
      approved: '已审核并保存。',
      sources: '检索来源（请逐项核对）',
      empty: '请对照原始商品资料核对。',
      save: '保存草稿',
      reload: '载入最新稿',
      savedBy: '保存人',
      copy: '复制',
      download: '下载',
      record: '下载审核记录',
      saving: '正在保存…',
      unsaved: '修改尚未保存',
      original: '查看原稿',
      compare: '保留我的修改并对照最新稿',
    },
    'zh-TW': {
      edit: '編輯草稿',
      translation: '譯文',
      approve: '確認審核',
      revoke: '撤回審核',
      reviewHint: '核對商品事實與來源後確認審核。',
      approved: '已審核並儲存。',
      sources: '檢索來源（請逐項核對）',
      empty: '請對照原始商品資料核對。',
      save: '儲存草稿',
      reload: '載入最新稿',
      savedBy: '儲存者',
      copy: '複製',
      download: '下載',
      record: '下載審核紀錄',
      saving: '正在儲存…',
      unsaved: '修改尚未儲存',
      original: '查看原稿',
      compare: '保留我的修改並對照最新稿',
    },
  }[locale];
  const editorId = useId();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const reviewHintId = useId();
  const saved = item.body.review;
  const key = ['content-items', projectId];
  const dirty = draft.text !== savedDraft(item).text || draft.reviewed !== Boolean(saved?.reviewed);
  const approved = !stale && draft.reviewed && Boolean(saved?.reviewed) && !dirty;
  const canSave = !busy && Boolean(draft.text.trim());
  const actionClass = 'h-9 min-h-10 rounded-md px-2.5 shadow-none transition-none sm:min-h-9';
  const reviewStatus = busy ? copy.saving : dirty ? copy.unsaved : approved ? copy.approved : '';
  const rows = Math.min(
    14,
    Math.max(
      subject ? 1 : 3,
      draft.text
        .split('\n')
        .reduce((height, line) => height + Math.max(1, Math.ceil(line.length / 72)), 0),
    ),
  );
  async function save(reviewed: boolean) {
    if (!canSave) return;
    setBusy(true);
    setError('');
    try {
      const review = await apiClient.put<SavedContentReview>(
        '/content/items/' + item.id + '/review',
        { revision: draft.revision, reviewed, text: draft.text },
      );
      await client.cancelQueries({ queryKey: key });
      client.setQueryData<ContentItemSummary[]>(key, (items) =>
        items?.map((i) => (i.id === item.id ? { ...i, body: { ...i.body, review } } : i)),
      );
      onSaved();
    } catch (e) {
      setError(errorMessage(e, undefined, locale));
    } finally {
      setBusy(false);
    }
  }
  async function reload(keepText = false) {
    setBusy(true);
    try {
      await client.refetchQueries({ queryKey: key }, { throwOnError: true });
      const latest = client.getQueryData<ContentItemSummary[]>(key)?.find((i) => i.id === item.id);
      if (keepText && latest)
        onChange({ ...draft, reviewed: false, revision: savedDraft(latest).revision });
      else onSaved();
      setError('');
    } catch (e) {
      setError(errorMessage(e, undefined, locale));
    } finally {
      setBusy(false);
    }
  }
  async function deliver(kind: 'copy' | 'download' | 'record') {
    setError('');
    async function payload() {
      const delivered = await apiClient.get<{ review: SavedContentReview; citations: Sources }>(
        '/content/items/' + item.id + '/delivery',
      );
      if (delivered.review.revision !== draft.revision)
        throw new ApiError('', 409, 'REVIEW_CONFLICT');
      return delivered;
    }
    try {
      if (kind === 'copy' && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': payload().then((p) => new Blob([p.review.text], { type: 'text/plain' })),
          }),
        ]);
        return;
      }
      const p = await payload();
      if (kind === 'copy') await navigator.clipboard.writeText(p.review.text);
      else if (kind === 'record')
        downloadFile(
          JSON.stringify({ itemId: item.id, ...p }, null, 2),
          filename + '.review.json',
          'application/json',
        );
      else downloadFile(p.review.text, filename, 'text/plain;charset=utf-8');
    } catch (e) {
      setError(errorMessage(e, copy.reload, locale));
    }
  }
  return (
    <div className={documentLayout ? 'min-w-0 px-3 pb-3 pt-3 sm:px-4 sm:pt-4' : 'min-w-0'}>
      <div className={source ? 'grid min-w-0 gap-3 lg:grid-cols-2 lg:gap-4' : 'min-w-0'}>
        {source && (
          <div className="flex min-w-0 flex-col">
            <p className="mb-2 text-sm font-semibold">{source.label}</p>
            <div className="min-h-20 overflow-auto rounded-md border border-border bg-muted/50 px-3 py-3 sm:px-4 max-lg:max-h-32 lg:max-h-[min(56dvh,26rem)] lg:flex-1">
              <p className="whitespace-pre-wrap text-base leading-[normal] [overflow-wrap:anywhere]">
                {source.text}
              </p>
            </div>
          </div>
        )}
        <div className="flex min-w-0 flex-col">
          <label
            htmlFor={editorId}
            className={documentLayout ? 'sr-only' : 'mb-2 text-sm font-semibold'}
          >
            {source ? copy.translation : copy.edit}
          </label>
          <Textarea
            id={editorId}
            value={draft.text}
            disabled={busy}
            maxLength={24000}
            rows={rows}
            className={cn(
              'block max-h-[min(56dvh,26rem)] flex-1 overflow-auto rounded-md border-border bg-background/50 px-3 py-3 text-base leading-[normal] shadow-none [field-sizing:content] focus-visible:border-primary/60 focus-visible:bg-card focus-visible:ring-2 sm:px-4',
              subject ? 'min-h-12 font-medium' : 'min-h-20',
              documentLayout && 'sm:[padding-inline-end:max(1rem,calc(100%-72ch-1rem))]',
              withReferences &&
                'min-[1080px]:h-60 min-[1080px]:flex-none min-[1080px]:[field-sizing:fixed]',
            )}
            onChange={(e) => onChange({ ...draft, text: e.target.value, reviewed: false })}
          />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {saved && (
          <small className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {copy.savedBy} {saved.author} · v{saved.revision} ·{' '}
            {new Date(saved.savedAt).toLocaleString(locale)}
          </small>
        )}
        {saved && dirty && saved.text !== draft.text && (
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              {copy.reload} · v{saved.revision}
            </summary>
            <p className="max-h-48 overflow-auto whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
              {saved.text}
            </p>
          </details>
        )}
        {saved && item.body.raw && item.body.raw !== saved.text && (
          <details>
            <summary className="cursor-pointer text-sm font-medium">{copy.original}</summary>
            <p className="max-h-48 overflow-auto whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
              {item.body.raw}
            </p>
          </details>
        )}
        {error && (
          <div
            role="alert"
            className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm"
          >
            {error}{' '}
            <Button disabled={busy} size="sm" variant="outline" onClick={() => void reload()}>
              {copy.reload}
            </Button>
            {dirty && (
              <Button disabled={busy} size="sm" variant="outline" onClick={() => void reload(true)}>
                {copy.compare}
              </Button>
            )}
          </div>
        )}
      </div>
      {!documentLayout &&
        (citations.length > 0 ? (
          <details className="group/sources mt-3 rounded-lg border bg-muted/30">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
              <FileText size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="flex-1">{copy.sources}</span>
              <span className="tabular-nums text-muted-foreground">{citations.length}</span>
              <ChevronRight
                size={16}
                className="shrink-0 group-open/sources:rotate-90"
                aria-hidden="true"
              />
            </summary>
            <div className="space-y-2 border-t px-3 py-3 text-sm leading-6 text-muted-foreground">
              {citations.map((c) => (
                <p key={c.reference} className="[overflow-wrap:anywhere]">
                  <strong className="font-semibold text-foreground">
                    [{c.reference}] {c.title}
                  </strong>
                  <span className="block">{c.snippet}</span>
                </p>
              ))}
            </div>
          </details>
        ) : (
          !source && <p className="mt-2 text-xs text-muted-foreground">{copy.empty}</p>
        ))}
      <div
        className={cn(
          'mt-2.5 flex max-w-full flex-wrap items-center gap-x-3 gap-y-2',
          stale && 'w-fit rounded-lg bg-warning/[0.07] px-2.5 py-2',
        )}
      >
        {stale && (
          <div className="flex min-w-0 items-start gap-1.5 text-xs leading-5 text-amber-800 dark:text-amber-300">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p role="status">{stale.message}</p>
          </div>
        )}
        {approved && !source && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={actionClass}
              disabled={busy}
              onClick={() => void deliver('copy')}
            >
              <Clipboard size={15} aria-hidden="true" /> {copy.copy}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={actionClass}
              disabled={busy}
              onClick={() => void deliver('download')}
            >
              <Download size={15} aria-hidden="true" /> {copy.download}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={actionClass}
              disabled={busy}
              onClick={() => void deliver('record')}
            >
              {copy.record}
            </Button>
          </div>
        )}
        <div className="flex max-w-full flex-wrap items-center gap-1.5">
          {stale?.recoveryAction}
          {!approved && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(actionClass, 'text-muted-foreground')}
              disabled={!canSave || (!dirty && Boolean(saved))}
              onClick={() => void save(false)}
            >
              <Save size={15} className="max-[359px]:hidden" aria-hidden="true" />
              {copy.save}
            </Button>
          )}
          {!stale && (
            <Button
              type="button"
              size="sm"
              variant={approved ? 'ghost' : 'default'}
              aria-describedby={approved ? undefined : reviewHintId}
              className={cn(
                actionClass,
                approved
                  ? 'text-muted-foreground'
                  : 'disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100',
              )}
              disabled={!canSave}
              onClick={() => void save(!approved)}
            >
              {!approved && <Check size={15} className="max-[359px]:hidden" aria-hidden="true" />}
              {approved ? copy.revoke : copy.approve}
            </Button>
          )}
        </div>
        {!stale && !approved && (
          <p
            id={reviewHintId}
            className={reviewStatus ? 'sr-only' : 'text-xs leading-5 text-muted-foreground'}
          >
            {copy.reviewHint}
          </p>
        )}
        <p
          role="status"
          className={!reviewStatus || approved ? 'sr-only' : 'text-xs text-muted-foreground'}
        >
          {reviewStatus}
        </p>
      </div>
    </div>
  );
}
export function savedDraft(item: ContentItemSummary): ReviewDraft {
  const saved = item.body?.review;
  const raw = item.body?.parsed ?? item.body?.raw ?? '';
  return {
    itemId: item.id,
    text: saved?.text ?? (typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2)),
    reviewed: Boolean(saved?.reviewed),
    revision: saved?.revision ?? 0,
  };
}
