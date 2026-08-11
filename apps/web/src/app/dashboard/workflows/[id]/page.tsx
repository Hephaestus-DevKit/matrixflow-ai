'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  type Connection,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Save, Play, Trash2, ArrowLeft, Settings2, HelpCircle } from 'lucide-react';
import type {
  WorkflowDetail,
  WorkflowDSL,
  WorkflowEdge,
  WorkflowNode,
  WorkflowRunAccepted,
} from '@matrixflow/shared';
import { errorMessage } from '@/lib/errors';
import { toast } from 'sonner';

interface EditorNodeData {
  label: string;
  rawNode: WorkflowNode;
}

type EditorNode = Node<EditorNodeData>;

interface EditorEdgeData {
  condition?: WorkflowEdge['condition'];
}

const NODE_TYPES: Array<{ type: WorkflowNode['type']; label: string; desc: string }> = [
  { type: 'trigger', label: '手动触发器 (Trigger)', desc: '作为流的起点接收初始参数输入。' },
  {
    type: 'ai',
    label: 'AI 模型节点',
    desc: '调用项目管理员配置的 AI Provider 生成内容或执行分类。',
  },
  {
    type: 'transform',
    label: '数据转换节点 (Transform)',
    desc: '对上游节点的输出结果进行数据格式化。',
  },
  {
    type: 'condition',
    label: '条件分支节点 (Condition)',
    desc: '根据条件表达式路由到不同输出路径。',
  },
];

const PROMPT_OPTIONS = [
  { key: 'product_title', label: '商品标题 (product_title)' },
  { key: 'product_listing', label: 'Listing 页面 (product_listing)' },
  { key: 'product_faq', label: '商品 FAQ 问答 (product_faq)' },
  { key: 'tiktok_script', label: 'TikTok 带货脚本 (tiktok_script)' },
  { key: 'instagram_caption', label: 'Instagram 种草图文 (instagram_caption)' },
  { key: 'facebook_ad', label: 'Facebook 广告投放 (facebook_ad)' },
  { key: 'email_marketing', label: 'EDM 邮件营销 (email_marketing)' },
  { key: 'seo_blog', label: 'SEO 博客文章 (seo_blog)' },
  { key: 'customer_service_reply', label: '智能客服回复 (customer_service_reply)' },
  { key: 'negative_review_reply', label: '差评应对公关 (negative_review_reply)' },
  { key: 'multilingual_translate', label: '多语言翻译 (multilingual_translate)' },
  { key: 'brand_voice_rewrite', label: '品牌语气润色 (brand_voice_rewrite)' },
];

export default function WorkflowEditorPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);

  // ReactFlow Nodes and Edges State
  const [nodes, setNodes, onNodesChange] = useNodesState<EditorNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<EditorEdgeData>([]);
  const [selectedNode, setSelectedNode] = useState<EditorNode | null>(null);

  // Node Editing Form State
  const [editConfig, setEditConfig] = useState<Record<string, unknown>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: wf } = useQuery({
    queryKey: ['wf', id],
    queryFn: () => apiClient.get<WorkflowDetail>(`/workflows/${id}`),
    enabled: !!id,
  });

  // Populate ReactFlow graph from Database DSL
  useEffect(() => {
    if (wf?.versions?.[0]?.dsl) {
      const dsl = wf.versions[0].dsl;
      const initialNodes =
        dsl.nodes?.map((node) => ({
          id: node.id,
          type: 'default',
          position: {
            x: node.position?.x ?? Math.random() * 300 + 100,
            y: node.position?.y ?? Math.random() * 300 + 100,
          },
          data: {
            label: `${node.type.toUpperCase()}: ${configLabel(node.config)}`,
            rawNode: node,
          },
        })) ?? [];

      const initialEdges =
        dsl.edges?.map((edge, index) => ({
          id: `e${index}`,
          source: edge.source,
          target: edge.target,
          data: { condition: edge.condition },
          label: edge.condition && edge.condition !== 'always' ? edge.condition : undefined,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#3b82f6',
          },
          style: { stroke: '#3b82f6', strokeWidth: 2 },
        })) ?? [];

      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [wf, setNodes, setEdges]);

  // Connect two nodes
  const onConnect = useCallback(
    (params: Connection) => {
      const source = nodes.find((node) => node.id === params.source);
      const isCondition = source?.data.rawNode.type === 'condition';
      const hasTrueBranch = edges.some(
        (edge) => edge.source === params.source && edge.data?.condition === 'true',
      );
      const condition: WorkflowEdge['condition'] | undefined = isCondition
        ? hasTrueBranch
          ? 'false'
          : 'true'
        : undefined;
      setEdges((current) =>
        addEdge(
          {
            ...params,
            data: { condition },
            label: condition,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
            style: { stroke: '#3b82f6', strokeWidth: 2 },
          },
          current,
        ),
      );
    },
    [edges, nodes, setEdges],
  );

  // Trigger executing the workflow run
  const runMutation = useMutation({
    mutationFn: () => apiClient.post<WorkflowRunAccepted>(`/workflows/${id}/run`, {}),
    onSuccess: (result) =>
      alert(`工作流已提交！运行状态: ${result.status}，运行 ID: ${result.runId}`),
  });

  // Save new workflow DSL version back to database
  const saveMutation = useMutation({
    mutationFn: (body: { dsl: WorkflowDSL; changeNote: string }) =>
      apiClient.post(`/workflows/${id}/versions`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wf', id] });
      alert('工作流配置已成功保存！');
    },
    onError: (error: unknown) => {
      alert(`保存失败: ${errorMessage(error)}`);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => apiClient.del(`/workflows/${id}`),
    onSuccess: () => {
      toast.success('工作流及其版本和运行记录已删除');
      router.push('/dashboard/workflows');
    },
    onError: (error: unknown) => toast.error(errorMessage(error, '工作流删除失败')),
  });

  // When node is clicked, show editor pane
  const onNodeClick = (_event: React.MouseEvent, node: EditorNode) => {
    setSelectedNode(node);
    setEditConfig(node.data?.rawNode?.config || {});
  };

  // When empty canvas clicked, clear selected node
  const onPaneClick = () => {
    setSelectedNode(null);
  };

  // Add a new node to the canvas
  const addNode = (type: WorkflowNode['type']) => {
    const newId = `${type}_${Date.now().toString().slice(-4)}`;
    const newNode: EditorNode = {
      id: newId,
      type: 'default',
      position: { x: 250, y: 150 },
      data: {
        label: `${type.toUpperCase()}: 未配置`,
        rawNode: {
          id: newId,
          type,
          config: {},
          position: { x: 250, y: 150 },
        },
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(newNode);
    setEditConfig({});
  };

  // Delete selected node
  const deleteNode = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id),
    );
    setSelectedNode(null);
  };

  // Update selected node config
  const handleSaveNodeConfig = () => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNode.id) {
          const updatedRaw = { ...n.data.rawNode, config: editConfig };
          const labelText = configLabel(editConfig) || '已配置';
          return {
            ...n,
            data: {
              ...n.data,
              rawNode: updatedRaw,
              label: `${updatedRaw.type.toUpperCase()}: ${labelText}`,
            },
          };
        }
        return n;
      }),
    );
    alert('节点属性配置已缓存至画布，别忘了点击右上角的“保存配置”提交哦！');
  };

  // Compile and save workflow version
  const handleSaveWorkflow = () => {
    const dslNodes = nodes.map((n) => {
      const raw = n.data.rawNode || {};
      return {
        id: n.id,
        type: raw.type || 'ai',
        config: raw.config || {},
        position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      };
    });

    const dslEdges = edges.map((e) => ({
      source: e.source,
      target: e.target,
      condition: e.data?.condition,
    }));

    saveMutation.mutate({
      dsl: { nodes: dslNodes, edges: dslEdges },
      changeNote: `可视化配置修改于 ${new Date().toLocaleTimeString()}`,
    });
  };

  if (!mounted) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-5">
          <h1 className="text-xl font-bold tracking-tight">工作流</h1>
        </div>
        <div className="h-[600px] rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground text-sm">
          加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in flex flex-col h-[calc(100vh-140px)]">
      {/* Editor Top Bar */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/workflows')}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{wf?.name ?? '工作流编辑器'}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              当前版本: v{wf?.currentVersion ?? 1} · 拖动节点或接头进行可视化连接
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              if (window.confirm('确定删除该工作流、全部版本和运行记录吗？'))
                deleteMutation.mutate();
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" /> 删除
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => router.push(`/dashboard/workflows/${id}/runs`)}
          >
            运行历史
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs border-primary/20 text-primary hover:bg-primary/5 gap-1.5"
            onClick={handleSaveWorkflow}
            disabled={saveMutation.isPending}
          >
            <Save className="h-3.5 w-3.5" /> 保存配置
          </Button>
          <Button
            size="sm"
            className="text-xs gap-1.5 shadow-glow-sm hover:shadow-glow"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
          >
            <Play className="h-3.5 w-3.5 fill-current" />{' '}
            {runMutation.isPending ? '正在运行...' : '运行'}
          </Button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex gap-4 grow min-h-0">
        {/* Canvas Area */}
        <div className="flex-1 rounded-xl border border-border bg-card relative overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
          >
            <Background color="#555" gap={16} />
            <Controls className="bg-card text-foreground border-border fill-current" />
            <MiniMap
              nodeColor="#1e293b"
              maskColor="rgba(0, 0, 0, 0.5)"
              className="bg-card border border-border rounded-lg"
            />
          </ReactFlow>
        </div>

        {/* Properties / Nodes Control Sidebar */}
        <div className="w-[320px] rounded-xl border border-border bg-card p-5 overflow-y-auto flex flex-col justify-between shrink-0 shadow-dark-sm">
          {selectedNode ? (
            /* Selected Node Properties Editor */
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-sm font-bold flex items-center gap-1.5 text-primary">
                  <Settings2 className="h-4 w-4" /> 属性编辑
                </h3>
                <span className="rounded bg-muted px-2 py-0.5 text-3xs font-semibold text-muted-foreground uppercase">
                  {selectedNode.data?.rawNode?.type}
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">节点唯一标识 (ID)</Label>
                <Input value={selectedNode.id} disabled className="bg-muted/40 font-mono text-xs" />
              </div>

              {/* Node specific configs */}
              {selectedNode.data?.rawNode?.type === 'ai' && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">选择 AI 提示词模板 (Prompt Key)</Label>
                  <select
                    value={configText(editConfig, 'promptKey')}
                    onChange={(e) => setEditConfig({ ...editConfig, promptKey: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border-border/80 text-foreground"
                  >
                    <option value="" disabled>
                      -- 请选择提示词模板 --
                    </option>
                    {PROMPT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedNode.data?.rawNode?.type === 'email' && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">通知收件人邮箱 (Email Address)</Label>
                  <Input
                    type="email"
                    value={configText(editConfig, 'to')}
                    onChange={(e) => setEditConfig({ ...editConfig, to: e.target.value })}
                    placeholder="e.g. boss@company.com"
                    className="text-sm bg-muted/10 border-border/60 focus-visible:ring-primary/30"
                  />
                  <Label className="text-xs font-semibold">邮件主题</Label>
                  <Input
                    value={configText(editConfig, 'subject')}
                    onChange={(e) => setEditConfig({ ...editConfig, subject: e.target.value })}
                    placeholder="工作流执行结果"
                    className="text-sm bg-muted/10 border-border/60 focus-visible:ring-primary/30"
                  />
                  <Label className="text-xs font-semibold">邮件正文模板</Label>
                  <textarea
                    value={configText(editConfig, 'body')}
                    onChange={(e) => setEditConfig({ ...editConfig, body: e.target.value })}
                    placeholder="执行结果：{{input}}"
                    rows={4}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              )}

              {selectedNode.data?.rawNode?.type === 'webhook' && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">网络钩子地址 (Webhook URL)</Label>
                  <Input
                    type="url"
                    value={configText(editConfig, 'url')}
                    onChange={(e) => setEditConfig({ ...editConfig, url: e.target.value })}
                    placeholder="e.g. https://api.mycrm.com/v1/leads"
                    className="text-sm bg-muted/10 border-border/60 focus-visible:ring-primary/30"
                  />
                </div>
              )}

              {selectedNode.data?.rawNode?.type === 'transform' && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">转换模板内容 (JSON/Txt Template)</Label>
                  <textarea
                    value={configText(editConfig, 'template')}
                    onChange={(e) => setEditConfig({ ...editConfig, template: e.target.value })}
                    placeholder="e.g. {{ai.content}} converted to text..."
                    rows={4}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border-border/80 text-foreground"
                  />
                </div>
              )}

              {selectedNode.data?.rawNode?.type === 'condition' && (
                <div className="space-y-3">
                  <Label className="text-xs font-semibold">比较字段路径</Label>
                  <Input
                    value={configText(editConfig, 'field')}
                    onChange={(e) => setEditConfig({ ...editConfig, field: e.target.value })}
                    placeholder="e.g. score"
                    className="text-sm bg-muted/10 border-border/60 focus-visible:ring-primary/30"
                  />
                  <Label className="text-xs font-semibold">比较操作符</Label>
                  <select
                    value={configText(editConfig, 'operator') || 'eq'}
                    onChange={(e) => setEditConfig({ ...editConfig, operator: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'truthy'].map(
                      (operator) => (
                        <option key={operator} value={operator}>
                          {operator}
                        </option>
                      ),
                    )}
                  </select>
                  <Label className="text-xs font-semibold">期望值</Label>
                  <Input
                    value={configText(editConfig, 'value')}
                    onChange={(e) => setEditConfig({ ...editConfig, value: e.target.value })}
                    placeholder="e.g. 0.8"
                    className="text-sm bg-muted/10 border-border/60 focus-visible:ring-primary/30"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    条件节点的第一条出边标记为 true，第二条出边标记为 false。
                  </p>
                </div>
              )}

              {selectedNode.data?.rawNode?.type === 'trigger' && (
                <p className="text-xs text-muted-foreground leading-normal">
                  手动触发器节点不需要额外属性配置。连接该节点的下一个节点将自动接收到初始输入负载。
                </p>
              )}

              <div className="flex gap-2 pt-3 border-t border-border/60">
                <Button
                  variant="destructive"
                  size="sm"
                  className="grow text-xs gap-1"
                  onClick={deleteNode}
                >
                  <Trash2 className="h-3.5 w-3.5" /> 删除节点
                </Button>
                <Button size="sm" className="grow text-xs" onClick={handleSaveNodeConfig}>
                  应用更改
                </Button>
              </div>
            </div>
          ) : (
            /* Node Adding Tool Box */
            <div className="space-y-5">
              <div className="border-b border-border pb-3">
                <h3 className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                  <Plus className="h-4 w-4 text-primary" /> 添加节点到画布
                </h3>
              </div>

              <div className="space-y-3.5">
                {NODE_TYPES.map((nt) => (
                  <button
                    key={nt.type}
                    onClick={() => addNode(nt.type)}
                    className="w-full text-left rounded-xl border border-border/60 bg-muted/10 p-3 hover:border-primary/20 hover:bg-primary/5 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                        {nt.label}
                      </span>
                      <Plus className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-3xs text-muted-foreground mt-1 leading-normal">{nt.desc}</p>
                  </button>
                ))}
              </div>

              <div className="rounded-lg bg-muted/30 p-3 text-3xs text-muted-foreground leading-relaxed flex gap-1.5 border border-border/40">
                <HelpCircle className="h-4 w-4 shrink-0 text-primary/70" />
                <div>
                  <span className="font-bold text-foreground block mb-0.5">如何配置及连接？</span>
                  1. 选择左侧节点可在本面板配置其专有属性参数。
                  <br />
                  2. 拖动节点右侧/左侧的连接点连接下一个节点以建立 DAG 工作流逻辑。
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-border mt-6 shrink-0">
            <p className="text-[10px] text-muted-foreground text-center">
              MatrixFlow AI · 可靠的跨境电商自动化核心引擎
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function configText(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : '';
}

function configLabel(config: Record<string, unknown> | undefined): string {
  if (!config) return '';
  return ['promptKey', 'to', 'url'].map((key) => configText(config, key)).find(Boolean) ?? '';
}
