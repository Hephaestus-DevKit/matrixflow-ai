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
  {
    title: string;
    name: string;
    description: string;
    create: string;
    creating: string;
    failed: string;
  }
> = {
  'zh-CN': {
    title: '新建知识库',
    name: '名称',
    description: '描述',
    create: '创建',
    creating: '创建中…',
    failed: '知识库创建失败',
  },
  'zh-TW': {
    title: '建立知識庫',
    name: '名稱',
    description: '描述',
    create: '建立',
    creating: '建立中…',
    failed: '知識庫建立失敗',
  },
  en: {
    title: 'Create knowledge base',
    name: 'Name',
    description: 'Description',
    create: 'Create',
    creating: 'Creating…',
    failed: 'Could not create the knowledge base',
  },
};

export default function NewKbPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function create() {
    setPending(true);
    try {
      await apiClient.post('/kb', { name: name.trim(), description: desc.trim() });
      router.push('/dashboard/knowledge');
    } catch (error) {
      toast.error(errorMessage(error, copy.failed));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-bold">{copy.title}</h1>
      <div className="space-y-2">
        <Label htmlFor="knowledge-name">{copy.name}</Label>
        <Input id="knowledge-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="knowledge-description">{copy.description}</Label>
        <Input id="knowledge-description" value={desc} onChange={(e) => setDesc(e.target.value)} />
      </div>
      <Button onClick={create} disabled={!name.trim() || pending}>
        {pending ? copy.creating : copy.create}
      </Button>
    </div>
  );
}
