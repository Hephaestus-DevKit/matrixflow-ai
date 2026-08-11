'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';

const DEFAULT_DSL = {
  nodes: [
    { id: 'n1', type: 'trigger', config: {}, position: { x: 100, y: 100 } },
    { id: 'n2', type: 'ai', config: { promptKey: 'product_title' }, position: { x: 400, y: 100 } },
  ],
  edges: [{ source: 'n1', target: 'n2' }],
};

export default function NewWorkflowPage() {
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function create() {
    setPending(true);
    try {
      await apiClient.post('/workflows', { name: name.trim(), description: '', dsl: DEFAULT_DSL });
      router.push('/dashboard/workflows');
    } catch (error) {
      toast.error(errorMessage(error, '工作流创建失败'));
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
      <h1 className="text-xl font-bold">新建工作流</h1>
      <div className="space-y-2">
        <Label htmlFor="workflow-name">名称</Label>
        <Input id="workflow-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <Button type="submit" disabled={!name.trim() || pending}>
        {pending ? '创建中…' : '创建'}
      </Button>
    </form>
  );
}
