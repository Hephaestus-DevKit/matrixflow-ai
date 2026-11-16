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
    <div className="space-y-3">
      <Textarea
        aria-label={copy.edit}
        value={draft}
        rows={8}
        onChange={(e) => {
          setDraft(e.target.value);
          setReviewed(false);
        }}
      />
      <details>
        <summary>{copy.sources}</summary>
        {citations.length ? (
          citations.map((c) => (
            <p key={c.reference} className="text-xs my-2">
              [{c.reference}] {c.title}: {c.snippet}
            </p>
          ))
        ) : (
          <p className="text-xs">{copy.empty}</p>
        )}
      </details>
      <label className="flex gap-2 text-xs">
        <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
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
          compact
        />
      )}
    </div>
  );
}
