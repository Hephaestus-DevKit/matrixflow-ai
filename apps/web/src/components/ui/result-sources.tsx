'use client';
import type { RagAnswer } from '@matrixflow/shared';
import { useLocale } from '@/lib/i18n';
export function ResultSources({ citations }: { citations?: RagAnswer['citations'] }) {
  const { locale } = useLocale();
  if (!citations?.length) return null;
  return (
    <details className="mt-3 border-t border-border pt-3">
      <summary className="cursor-pointer text-xs font-semibold text-primary">
        {locale === 'en' ? 'Sources' : locale === 'zh-TW' ? '參考來源' : '参考来源'} (
        {citations.length})
      </summary>
      <ol className="mt-2 space-y-2">
        {citations.map((source, index) => (
          <li key={source.chunkId} className="rounded-lg bg-muted/40 p-3 text-xs leading-5">
            <strong>
              [{index + 1}] {source.title}
            </strong>
            <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{source.snippet}</p>
          </li>
        ))}
      </ol>
    </details>
  );
}
