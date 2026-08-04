'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NewKbPage() {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const router = useRouter();
  async function create() {
    await apiClient.post('/kb', { name, description: desc });
    router.push('/dashboard/knowledge');
  }
  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-bold">新建知识库</h1>
      <div className="space-y-2">
        <Label>名称</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>描述</Label>
        <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
      </div>
      <Button onClick={create} disabled={!name}>
        创建
      </Button>
    </div>
  );
}
