'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';

export default function NewKbPage() {
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
      toast.error(errorMessage(error, '知识库创建失败'));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-bold">新建知识库</h1>
      <div className="space-y-2">
        <Label htmlFor="knowledge-name">名称</Label>
        <Input id="knowledge-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="knowledge-description">描述</Label>
        <Input id="knowledge-description" value={desc} onChange={(e) => setDesc(e.target.value)} />
      </div>
      <Button onClick={create} disabled={!name.trim() || pending}>
        {pending ? '创建中…' : '创建'}
      </Button>
    </div>
  );
}
