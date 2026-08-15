'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
import { useLocale, type Locale } from '@/lib/i18n';

const COPY: Record<
  Locale,
  { title: string; name: string; create: string; creating: string; failed: string }
> = {
  'zh-CN': {
    title: '新建工作流',
    name: '名称',
    create: '创建',
    creating: '创建中…',
    failed: '工作流创建失败',
  },
  'zh-TW': {
    title: '建立工作流',
    name: '名稱',
    create: '建立',
    creating: '建立中…',
    failed: '工作流建立失敗',
  },
  en: {
    title: 'Create workflow',
    name: 'Name',
    create: 'Create',
    creating: 'Creating…',
    failed: 'Could not create the workflow',
  },
};

const DEFAULT_DSL = {
  nodes: [
    { id: 'n1', type: 'trigger', config: {}, position: { x: 100, y: 100 } },
    { id: 'n2', type: 'ai', config: { promptKey: 'product_title' }, position: { x: 400, y: 100 } },
  ],
  edges: [{ source: 'n1', target: 'n2' }],
};

export default function NewWorkflowPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function create() {
    setPending(true);
    try {
      await apiClient.post('/workflows', { name: name.trim(), description: '', dsl: DEFAULT_DSL });
      router.push('/dashboard/workflows');
    } catch (error) {
      toast.error(errorMessage(error, copy.failed));
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name) create();
      }}
      className="max-w-md space-y-4"
    >
      <h1 className="text-xl font-bold">{copy.title}</h1>
      <div className="space-y-2">
        <Label htmlFor="workflow-name">{copy.name}</Label>
        <Input id="workflow-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <Button type="submit" disabled={!name.trim() || pending}>
        {pending ? copy.creating : copy.create}
      </Button>
    </form>
  );
}
