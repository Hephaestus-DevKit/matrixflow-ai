'use client';

import { useState } from 'react';
import { Copy, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/lib/i18n';

export function ResultText({
  text,
  filename = 'matrixflow-result.txt',
  compact = false,
}: {
  text: string;
  filename?: string;
  compact?: boolean;
}) {
  const { locale } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const copy = {
    'zh-CN': {
      copy: '复制',
      copied: '已复制',
      download: '下载',
      expand: '展开全文',
      collapse: '收起',
      failed: '复制失败，请选择文本手动复制',
    },
    'zh-TW': {
      copy: '複製',
      copied: '已複製',
      download: '下載',
      expand: '展開全文',
      collapse: '收起',
      failed: '複製失敗，請選取文字手動複製',
    },
    en: {
      copy: 'Copy',
      copied: 'Copied',
      download: 'Download',
      expand: 'Expand',
      collapse: 'Collapse',
      failed: 'Copy failed. Select the text and copy it manually.',
    },
  }[locale];
  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(copy.copied);
    } catch {
      toast.error(copy.failed);
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename.replace(/[^\p{L}\p{N}_.-]/gu, '-');
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
  return (
    <div className="space-y-2 min-w-0">
      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => void copyText()}
          className="gap-1.5"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          {copy.copy}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={download} className="gap-1.5">
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          {copy.download}
        </Button>
        {compact && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? copy.collapse : copy.expand}
          </Button>
        )}
      </div>
      <pre
        tabIndex={0}
        className={`whitespace-pre-wrap break-words rounded-xl border border-border/50 bg-muted/30 p-4 font-sans text-sm leading-6 ${compact && !expanded ? 'max-h-48 overflow-auto' : 'max-h-[70vh] overflow-auto'}`}
      >
        {text}
      </pre>
    </div>
  );
}
