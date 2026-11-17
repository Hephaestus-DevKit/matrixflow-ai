'use client';
import { useState } from 'react';
import { ResultText } from '@/components/ui/result-text';
import { Textarea } from '@/components/ui/textarea';
import { useLocale } from '@/lib/i18n';

export function ContentReview({
  text,
  filename,
  citations,
}: {
  text: string;
  filename: string;
  citations: { title: string; snippet: string; reference: number }[];
}) {
  const { locale } = useLocale();
  const [draft, setDraft] = useState(text);
  const [reviewed, setReviewed] = useState(false);
  const copy =
    locale === 'en'
      ? {
          edit: 'Edit draft',
          check: 'I checked product facts, claims and sources',
          sources: 'Retrieved sources (verify each claim)',
          empty: 'Product facts only; no knowledge sources attached.',
        }
      : locale === 'zh-TW'
        ? {
            edit: '編輯草稿',
            check: '我已核對商品事實、宣稱與來源',
            sources: '檢索來源（請逐項核對）',
            empty: '僅使用商品資料，未附知識庫來源。',
          }
        : {
            edit: '编辑草稿',
            check: '我已核对商品事实、宣称与来源',
            sources: '检索来源（请逐项核对）',
            empty: '仅使用商品资料，未附知识库来源。',
          };
  return (
    <div className="grid min-w-0 gap-4 border-t border-border/70 pt-4 md:grid-cols-[minmax(0,2fr)_minmax(14rem,1fr)]">
      <Textarea
        aria-label={copy.edit}
        value={draft}
        rows={Math.min(14, Math.max(4, text.split('\n').length + Math.ceil(text.length / 90)))}
        className="resize-y leading-7"
        onChange={(e) => {
          setDraft(e.target.value);
          setReviewed(false);
        }}
      />
      <div className="flex min-w-0 flex-col items-stretch gap-3">
        <details className="min-w-0 self-start rounded-xl border bg-muted/30 p-4">
          <summary className="cursor-pointer text-sm font-semibold">{copy.sources}</summary>
          {citations.length ? (
            citations.map((c) => (
              <p
                key={c.reference}
                className="my-3 break-words border-l-2 border-primary/40 pl-3 text-sm leading-6"
              >
                [{c.reference}] {c.title}: {c.snippet}
              </p>
            ))
          ) : (
            <p className="text-xs">{copy.empty}</p>
          )}
        </details>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-muted/40 p-3 text-sm">
          <input
            type="checkbox"
            disabled={!draft.trim()}
            checked={reviewed}
            onChange={(e) => setReviewed(e.target.checked)}
          />
          {copy.check}
        </label>
        {reviewed && (
          <ResultText
            text={
              draft +
              (citations.length
                ? `\n\n${copy.sources}\n` +
                  citations.map((c) => `[${c.reference}] ${c.title}: ${c.snippet}`).join('\n')
                : '')
            }
            filename={filename}
            actionsOnly
          />
        )}
      </div>
    </div>
  );
}
