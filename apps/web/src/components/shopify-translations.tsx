'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Sparkles, Upload as UploadIcon } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ContentItemSummary } from '@matrixflow/shared';
import { ContentReview, savedDraft, type ReviewDraft } from './content-review';
import { Button } from './ui/button';
import { Select } from './ui/select';
import { apiClient } from '@/lib/api-client';
import { errorMessage } from '@/lib/errors';
import { useLocale } from '@/lib/i18n';
import { isActiveJob, type BackgroundJob } from '@/lib/jobs';
import { JobProgress } from './job-progress';
import { downloadFile, parseTranslationCsv, translationCsv } from '@/lib/shopify-translations';

const labels = {
  en: {
    previous: 'Previous field',
    next: 'Next field',
    awaiting: 'Awaiting review',
    complete: 'Approved',
    empty: 'Needs translation',
    hint: 'Use a Shopify language CSV with up to 40 product fields. If the source changes, review the updated translation.',
    choose: 'Choose CSV',
    importHeading: 'Import CSV',
    fieldNames: {
      title: 'Title',
      body_html: 'Description',
      meta_title: 'SEO title',
      meta_description: 'SEO description',
    },
    sample: 'Download example CSV',
    importRows: 'Import rows',
    supported: 'supported',
    skipped: 'skipped',
    batch: 'Select upload',
    field: 'Select field',
    source: 'Source',
    generate: 'Generate translation',
    generateMissing: 'Translate remaining empty fields',
    exportApproved: 'Export approved rows',
    record: 'Review record',
    approved: 'approved',
    invalid: 'Invalid Shopify language CSV, duplicate identity, or upload limit exceeded.',
    existing: 'Existing translations are kept for review.',
    unsaved: 'Save or discard local edits before exporting.',
    discard: 'Discard local edit',
  },
  'zh-CN': {
    previous: '上一字段',
    next: '下一字段',
    awaiting: '待审核',
    complete: '已审核',
    empty: '待翻译',
    hint: '使用 Shopify 导出的语言 CSV，每次最多 40 个商品字段。原文更新后需重新审核。',
    choose: '选择 CSV',
    importHeading: '导入 CSV',
    fieldNames: {
      title: '商品标题',
      body_html: '商品描述',
      meta_title: 'SEO 标题',
      meta_description: 'SEO 描述',
    },
    sample: '下载示例 CSV',
    importRows: '导入这些行',
    supported: '可导入',
    skipped: '跳过',
    batch: '选择导入批次',
    field: '选择商品字段',
    source: '原文',
    generate: '生成译文',
    generateMissing: '翻译剩余空白字段',
    exportApproved: '导出已审核译文',
    record: '导出审核记录',
    approved: '已审核',
    invalid: '请检查 Shopify 语言表格式、重复标识和导入上限。',
    existing: '已有译文将保留供审核。',
    unsaved: '请先保存或放弃本地修改，再导出。',
    discard: '放弃本地修改',
  },
  'zh-TW': {
    previous: '上一欄位',
    next: '下一欄位',
    awaiting: '待審核',
    complete: '已審核',
    empty: '待翻譯',
    hint: '使用 Shopify 匯出的語言 CSV，每次最多 40 個商品欄位。原文更新後須重新審核。',
    choose: '選擇 CSV',
    importHeading: '匯入 CSV',
    fieldNames: {
      title: '商品標題',
      body_html: '商品描述',
      meta_title: 'SEO 標題',
      meta_description: 'SEO 描述',
    },
    sample: '下載示例 CSV',
    importRows: '匯入這些列',
    supported: '可匯入',
    skipped: '略過',
    batch: '選擇匯入批次',
    field: '選擇商品欄位',
    source: '原文',
    generate: '產生譯文',
    generateMissing: '翻譯其餘空白欄位',
    exportApproved: '匯出已審核譯文',
    record: '匯出審核紀錄',
    approved: '已審核',
    invalid: '請檢查 Shopify 語言表格式、重複識別碼和匯入上限。',
    existing: '保留現有譯文供審核。',
    unsaved: '請先儲存或放棄本機修改，再匯出。',
    discard: '放棄本機修改',
  },
};
type Upload = ReturnType<typeof parseTranslationCsv> & { filename: string };
export function ShopifyTranslations({
  projectId,
  items,
  jobId,
}: {
  projectId: string;
  items: ContentItemSummary[];
  jobId: string | null;
}) {
  const { locale } = useLocale(),
    c = labels[locale],
    client = useQueryClient();
  const [upload, setUpload] = useState<Upload>(),
    [batch, setBatch] = useState(''),
    [selection, setSelection] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [importExpanded, setImportExpanded] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const fileRead = useRef(0);
  useEffect(
    () => () => {
      fileRead.current++;
    },
    [],
  );
  const jobState = useQuery({
    queryKey: ['job', jobId],
    queryFn: ({ signal }) => apiClient.get<BackgroundJob>(`/jobs/${jobId}`, { signal }),
    enabled: false,
  });
  const batchRunning = Boolean(
    jobId && !jobState.isError && (!jobState.data || isActiveJob(jobState.data)),
  );
  const batches = new Map(
    items.flatMap((item) =>
      item.metadata?.shopify
        ? [[item.metadata.shopify.batch, item.metadata.shopify.filename] as const]
        : [],
    ),
  );
  const activeBatch = batches.has(batch) ? batch : batches.keys().next().value;
  const rows = items
    .filter((item) => activeBatch && item.metadata?.shopify?.batch === activeBatch)
    .sort((a, b) => a.metadata!.shopify!.position - b.metadata!.shopify!.position);
  const selected = rows.find((row) => row.id === selection) ?? rows[0];
  const dirty = rows.some((row) => drafts[row.id]);
  const approved = rows.filter((row) => row.body.review?.reviewed).length;
  const field = (item: ContentItemSummary, name: string) => {
    const s = item.metadata!.shopify!;
    return s.values[s.headers.indexOf(name)];
  };
  const describe = (item: ContentItemSummary) => {
    const fieldKey = field(item, 'Field');
    return [
      field(item, 'Identification'),
      c.fieldNames[fieldKey as keyof typeof c.fieldNames] ?? fieldKey,
      field(item, 'Locale'),
      field(item, 'Market'),
    ]
      .filter(Boolean)
      .join(' / ');
  };
  const refresh = () => client.invalidateQueries({ queryKey: ['content-items', projectId] });
  function clear(id: string) {
    setDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }
  async function preview(file?: File) {
    const request = ++fileRead.current;
    setUpload(undefined);
    setError('');
    if (!file) return;
    try {
      if (file.size > 512_000) throw Error();
      const raw = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      const parsed = parseTranslationCsv(raw);
      if (request !== fileRead.current) return;
      if (parsed.rows.length > 40 || new Blob([JSON.stringify(parsed)]).size > 118000)
        throw Error();
      setUpload({ ...parsed, filename: file.name });
    } catch {
      if (request === fileRead.current) setError(c.invalid);
    }
  }
  async function submit() {
    if (!upload || busy) return;
    setBusy(true);
    setError('');
    try {
      const { filename, headers, rows } = upload;
      const reply = await apiClient.post<{ batch: string }>(
        '/content/projects/' + projectId + '/translations',
        { filename, headers, rows },
        { timeoutMs: 120000 },
      );
      await refresh();
      setBatch(reply.batch);
      setSelection('');
      setUpload(undefined);
      setImportExpanded(false);
    } catch (e) {
      setError(errorMessage(e, c.invalid, locale));
    } finally {
      setBusy(false);
    }
  }
  async function generate(row: ContentItemSummary) {
    setBusy(true);
    setError('');
    try {
      await apiClient.post(
        '/content/items/' + row.id + '/translate',
        { revision: row.body.review?.revision ?? 0 },
        { timeoutMs: 120000 },
      );
      await refresh();
    } catch (e) {
      setError(errorMessage(e, undefined, locale));
    } finally {
      setBusy(false);
    }
  }
  async function generateMissing() {
    if (!activeBatch || batchRunning || !missing.length) return;
    setBusy(true);
    setError('');
    try {
      const job = await apiClient.post<BackgroundJob>(
        '/content/projects/' + projectId + '/translations/' + activeBatch,
        { items: missing.map((row) => ({ id: row.id, revision: row.body.review?.revision ?? 0 })) },
      );
      client.setQueryData(['job', job.id], job);
      const url = new URL(window.location.href);
      if (url.pathname === '/dashboard/content' && url.searchParams.get('project') === projectId) {
        url.searchParams.set('translationJob', job.id);
        window.history.replaceState(null, '', url);
      }
    } catch (e) {
      setError(errorMessage(e, undefined, locale));
    } finally {
      setBusy(false);
    }
  }
  async function deliver(record: boolean) {
    setBusy(true);
    setError('');
    try {
      const data = await apiClient.get<{ headers: string[]; rows: string[][]; reviews: unknown[] }>(
        '/content/projects/' + projectId + '/translations/' + activeBatch,
      );
      const name = (batches.get(activeBatch!) ?? 'shopify').replace(/\.csv$/i, '');
      if (record)
        downloadFile(
          JSON.stringify(data.reviews, null, 2),
          name + '.review.json',
          'application/json',
        );
      else
        downloadFile(
          translationCsv(data.headers, data.rows),
          name + '.reviewed.csv',
          'text/csv;charset=utf-8',
        );
    } catch (e) {
      setError(errorMessage(e, undefined, locale));
    } finally {
      setBusy(false);
    }
  }
  const missing = rows.filter((row) => !drafts[row.id] && !savedDraft(row).text.trim());
  const selectedIndex = rows.findIndex((row) => row.id === selected?.id);
  const selectedDraft = selected ? (drafts[selected.id] ?? savedDraft(selected)) : null;
  const jobErrors = jobState.data?.result?.errors;
  const failedField = Array.isArray(jobErrors)
    ? jobErrors.find((issue) => issue?.id === selected?.id)
    : undefined;
  const status = selectedDraft?.reviewed
    ? c.complete
    : selectedDraft?.text.trim()
      ? c.awaiting
      : c.empty;

  return (
    <section className="min-w-0 rounded-xl border bg-card">
      {jobId && (
        <div className="p-3 sm:px-4">
          <JobProgress
            key={jobId}
            jobId={jobId}
            showResult={false}
            onSettled={() => void refresh()}
          />
        </div>
      )}
      {rows.length > 0 && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-1.5 sm:px-4">
          <p className="text-sm font-medium tabular-nums text-muted-foreground">
            {approved} / {rows.length} {c.approved}
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-11 rounded-md"
            aria-expanded={importExpanded}
            aria-controls="shopify-import"
            disabled={busy}
            onClick={() => setImportExpanded((open) => !open)}
          >
            <UploadIcon size={16} aria-hidden="true" />
            {c.importHeading}
          </Button>
        </header>
      )}
      <div>
        <div
          id="shopify-import"
          hidden={Boolean(rows.length && !importExpanded)}
          className="space-y-2 px-3 py-3 sm:px-4"
        >
          <p className="max-w-prose text-xs leading-5 text-muted-foreground">
            {c.hint} {c.existing}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="relative inline-flex min-h-11 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-semibold focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 has-[:disabled]:opacity-50">
              <UploadIcon size={15} aria-hidden="true" />
              <span aria-hidden="true">{c.choose}</span>
              <input
                type="file"
                accept=".csv,text/csv"
                aria-label={c.choose}
                disabled={busy}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                onChange={(event) => {
                  const input = event.currentTarget;
                  const file = input.files?.[0];
                  void preview(file).finally(() => {
                    if (input.files?.[0] === file) input.value = '';
                  });
                }}
              />
            </label>
            <a
              href="/examples/shopify-translations.csv"
              download
              className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2"
            >
              <Download size={15} aria-hidden="true" /> {c.sample}
            </a>
          </div>
          {upload && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="max-w-full font-medium [overflow-wrap:anywhere]">
                {upload.filename}
              </span>
              <span className="text-muted-foreground">
                {upload.rows.length} {c.supported} / {upload.skipped} {c.skipped}
              </span>
              <Button
                className="rounded-lg shadow-none"
                disabled={busy || Object.keys(drafts).length > 0 || !upload.rows.length}
                onClick={submit}
              >
                {c.importRows}
              </Button>
            </div>
          )}
        </div>
        {error && (
          <p
            role="alert"
            className="whitespace-pre-line bg-destructive/5 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {selected && selectedDraft && (
          <>
            <div className="min-w-0 space-y-3 px-3 py-3 sm:px-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="min-w-0 space-y-1 text-sm font-medium">
                  <span>{c.batch}</span>
                  <Select
                    className="rounded-md shadow-none"
                    value={activeBatch}
                    disabled={busy}
                    onChange={(e) => {
                      setBatch(e.target.value);
                      setSelection('');
                    }}
                  >
                    {[...batches].map(([id, name]) => (
                      <option value={id} key={id}>
                        {name} ({id.slice(0, 6)})
                      </option>
                    ))}
                  </Select>
                </label>
                <div className="min-w-0 space-y-1">
                  <label htmlFor="shopify-translation-field" className="text-sm font-medium">
                    {c.field}
                  </label>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Select
                      id="shopify-translation-field"
                      className="min-w-0 flex-1 rounded-md shadow-none"
                      value={selected.id}
                      disabled={busy}
                      onChange={(e) => setSelection(e.target.value)}
                    >
                      {rows.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.body.review?.reviewed ? '✓ ' : ''}
                          {describe(row)}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>
              {failedField && !selectedDraft.text.trim() && (
                <p role="status" className="text-sm text-warning">
                  {errorMessage({ code: failedField.code }, undefined, locale)}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 max-w-full">
                  <p
                    className={`w-fit rounded-md px-2 py-1 text-xs font-medium ${selectedDraft.reviewed ? 'bg-[#e6f4eb] text-[#176438] dark:bg-[#17372d] dark:text-[#a0edc0]' : 'bg-muted text-muted-foreground'}`}
                  >
                    {status}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label={c.previous}
                    className="shrink-0 rounded-md shadow-none"
                    disabled={busy || selectedIndex <= 0}
                    onClick={() => setSelection(rows[selectedIndex - 1].id)}
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label={c.next}
                    className="shrink-0 rounded-md shadow-none"
                    disabled={busy || selectedIndex >= rows.length - 1}
                    onClick={() => setSelection(rows[selectedIndex + 1].id)}
                  >
                    <ChevronRight size={16} aria-hidden="true" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-11 whitespace-normal rounded-md text-start shadow-none"
                    disabled={
                      busy ||
                      batchRunning ||
                      Boolean(drafts[selected.id]) ||
                      Boolean(selected.body.review?.reviewed)
                    }
                    onClick={() => void generate(selected)}
                  >
                    <Sparkles size={16} aria-hidden="true" /> {c.generate}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto min-h-11 whitespace-normal rounded-md text-start"
                    disabled={busy || batchRunning || !missing.length}
                    onClick={() => void generateMissing()}
                  >
                    {c.generateMissing} ({missing.length})
                  </Button>
                </div>
              </div>

              <fieldset disabled={busy} className="min-w-0">
                <ContentReview
                  key={selected.id}
                  item={selected}
                  projectId={projectId}
                  filename="translation.txt"
                  source={{ label: c.source, text: field(selected, 'Default content') }}
                  draft={selectedDraft}
                  onChange={(draft) =>
                    setDrafts((current) => ({ ...current, [selected.id]: draft }))
                  }
                  onSaved={() => clear(selected.id)}
                  citations={selected.metadata?.citations ?? []}
                />
              </fieldset>
              {drafts[selected.id] && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => clear(selected.id)}
                >
                  {c.discard}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-xl border-t bg-muted/55 px-3 py-2 sm:px-4">
              {dirty && <p className="w-full text-sm text-muted-foreground">{c.unsaved}</p>}
              <Button
                variant="outline"
                className="rounded-lg shadow-none"
                disabled={busy || dirty || !approved}
                onClick={() => void deliver(true)}
              >
                {c.record}
              </Button>
              <Button
                className="rounded-lg shadow-none"
                disabled={busy || dirty || !approved}
                onClick={() => void deliver(false)}
              >
                <Download size={16} aria-hidden="true" /> {c.exportApproved}
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
