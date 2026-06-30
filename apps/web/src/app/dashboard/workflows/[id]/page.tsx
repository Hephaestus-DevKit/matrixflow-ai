'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

export default function WorkflowEditorPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: wf } = useQuery({ queryKey: ['wf', id], queryFn: () => apiClient.get<any>(`/workflows/${id}`), enabled: !!id });
  const run = useMutation({ mutationFn: () => apiClient.post<any>(`/workflows/${id}/run`, {}), onSuccess: (r: any) => alert(`运行完成: ${JSON.stringify(r?.output).slice(0, 200)}`) });

  const version = wf?.versions?.[0];
  const dsl = version?.dsl;
  const nodes = dsl?.nodes?.map((n: any) => ({ id: n.id, type: 'default', position: { x: n.positionX ?? n.position?.x ?? 0, y: n.positionY ?? n.position?.y ?? 0 }, data: { label: `${n.type}: ${n.config?.promptKey ?? ''}` } })) ?? [];
  const edges = dsl?.edges?.map((e: any, i: number) => ({ id: `e${i}`, source: e.source, target: e.target })) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{wf?.name ?? '工作流'}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/dashboard/workflows/${id}/logs` as any)}>日志</Button>
          <Button onClick={() => run.mutate()} disabled={run.isPending}>{run.isPending ? '运行中...' : '▶ 运行'}</Button>
        </div>
      </div>
      <div className="h-[600px] rounded-xl border border-border bg-card">
        <ReactFlow nodes={nodes} edges={edges} fitView>
          <Background /><Controls /><MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
