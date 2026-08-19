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
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageLoader } from '@/components/ui/states';
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
import { useLocale, type Locale } from '@/lib/i18n';

interface EditorNodeData {
  label: string;
  rawNode: WorkflowNode;
}

type EditorNode = Node<EditorNodeData>;

interface EditorEdgeData {
  condition?: WorkflowEdge['condition'];
}

const EDITOR_COPY = {
  'zh-CN': {
    workflows: '工作流',
    back: '返回工作流列表',
    editorFallback: '工作流编辑器',
    loading: '加载中…',
    currentVersion: (version: number) => `当前版本：v${version}`,
    editorHint: '拖动节点或连接点，建立可视化流程',
    delete: '删除',
    cancel: '取消',
    deleteConfirm: '确定删除该工作流、全部版本和运行记录吗？',
    history: '运行历史',
    save: '保存配置',
    saving: '保存中…',
    run: '运行',
    running: '正在运行…',
    runSubmitted: (status: string, runId: string) =>
      `工作流已提交！运行状态：${status}，运行 ID：${runId}`,
    saved: '工作流配置已成功保存！',
    saveFailed: (message: string) => `保存失败：${message}`,
    deleted: '工作流及其版本和运行记录已删除',
    deleteFailed: '工作流删除失败',
    configured: '已配置',
    unconfigured: '未配置',
    nodeCached: '节点属性已缓存至画布，请点击右上角“保存配置”提交。',
    changedAt: (time: string) => `可视化配置修改于 ${time}`,
    properties: '属性编辑',
    nodeId: '节点唯一标识 (ID)',
    promptTemplate: '选择 AI 提示词模板 (Prompt Key)',
    choosePrompt: '-- 请选择提示词模板 --',
    recipient: '通知收件人邮箱 (Email Address)',
    recipientPlaceholder: '例如：boss@company.com',
    subject: '邮件主题',
    subjectPlaceholder: '工作流执行结果',
    body: '邮件正文模板',
    bodyPlaceholder: '执行结果：{{input}}',
    webhook: '网络钩子地址 (Webhook URL)',
    webhookPlaceholder: '例如：https://api.mycrm.com/v1/leads',
    transform: '转换模板内容 (JSON/Txt Template)',
    transformPlaceholder: '例如：将 {{ai.content}} 转换为文本…',
    field: '比较字段路径',
    fieldPlaceholder: '例如：score',
    operator: '比较操作符',
    value: '期望值',
    valuePlaceholder: '例如：0.8',
    conditionHint: '条件节点的第一条出边标记为 true，第二条出边标记为 false。',
    triggerHint: '手动触发器不需要额外配置。下一个连接节点会自动接收初始输入。',
    deleteNode: '删除节点',
    apply: '应用更改',
    addNode: '添加节点到画布',
    helpTitle: '如何配置及连接？',
    helpOne: '选择节点后，在此面板配置它的属性参数。',
    helpTwo: '拖动节点两侧的连接点，连接下一个节点以建立 DAG 流程。',
    footer: 'MatrixFlow AI · 可靠的跨境电商自动化核心引擎',
    nodes: {
      trigger: '手动触发器 (Trigger)',
      triggerDesc: '作为流程起点接收初始参数。',
      ai: 'AI 模型节点',
      aiDesc: '调用已配置的 AI Provider 生成内容或执行分类。',
      transform: '数据转换节点 (Transform)',
      transformDesc: '将上游节点输出格式化为目标数据。',
      condition: '条件分支节点 (Condition)',
      conditionDesc: '根据条件表达式路由到不同输出路径。',
    },
    prompts: {
      product_title: '商品标题 (product_title)',
      product_listing: 'Listing 页面 (product_listing)',
      product_faq: '商品 FAQ 问答 (product_faq)',
      tiktok_script: 'TikTok 带货脚本 (tiktok_script)',
      instagram_caption: 'Instagram 种草图文 (instagram_caption)',
      facebook_ad: 'Facebook 广告投放 (facebook_ad)',
      email_marketing: 'EDM 邮件营销 (email_marketing)',
      seo_blog: 'SEO 博客文章 (seo_blog)',
      customer_service_reply: '智能客服回复 (customer_service_reply)',
      negative_review_reply: '差评应对公关 (negative_review_reply)',
      multilingual_translate: '多语言翻译 (multilingual_translate)',
      brand_voice_rewrite: '品牌语气润色 (brand_voice_rewrite)',
    },
  },
  'zh-TW': {
    workflows: '工作流',
    back: '返回工作流列表',
    editorFallback: '工作流編輯器',
    loading: '載入中…',
    currentVersion: (version: number) => `目前版本：v${version}`,
    editorHint: '拖曳節點或連接點，建立視覺化流程',
    delete: '刪除',
    cancel: '取消',
    deleteConfirm: '確定刪除此工作流、全部版本與執行記錄嗎？',
    history: '執行歷史',
    save: '儲存設定',
    saving: '儲存中…',
    run: '執行',
    running: '執行中…',
    runSubmitted: (status: string, runId: string) =>
      `工作流已提交！執行狀態：${status}，執行 ID：${runId}`,
    saved: '工作流設定已成功儲存！',
    saveFailed: (message: string) => `儲存失敗：${message}`,
    deleted: '工作流及其版本與執行記錄已刪除',
    deleteFailed: '工作流刪除失敗',
    configured: '已設定',
    unconfigured: '未設定',
    nodeCached: '節點屬性已暫存至畫布，請點擊右上角「儲存設定」提交。',
    changedAt: (time: string) => `視覺化設定修改於 ${time}`,
    properties: '屬性編輯',
    nodeId: '節點唯一識別碼 (ID)',
    promptTemplate: '選擇 AI 提示詞範本 (Prompt Key)',
    choosePrompt: '-- 請選擇提示詞範本 --',
    recipient: '通知收件人電子郵件 (Email Address)',
    recipientPlaceholder: '例如：boss@company.com',
    subject: '郵件主旨',
    subjectPlaceholder: '工作流執行結果',
    body: '郵件內容範本',
    bodyPlaceholder: '執行結果：{{input}}',
    webhook: '網路鉤子位址 (Webhook URL)',
    webhookPlaceholder: '例如：https://api.mycrm.com/v1/leads',
    transform: '轉換範本內容 (JSON/Txt Template)',
    transformPlaceholder: '例如：將 {{ai.content}} 轉換為文字…',
    field: '比較欄位路徑',
    fieldPlaceholder: '例如：score',
    operator: '比較運算子',
    value: '期望值',
    valuePlaceholder: '例如：0.8',
    conditionHint: '條件節點的第一條出邊標記為 true，第二條出邊標記為 false。',
    triggerHint: '手動觸發器不需要額外設定。下一個連接節點會自動接收初始輸入。',
    deleteNode: '刪除節點',
    apply: '套用變更',
    addNode: '新增節點至畫布',
    helpTitle: '如何設定及連接？',
    helpOne: '選擇節點後，在此面板設定它的屬性參數。',
    helpTwo: '拖曳節點兩側的連接點，連接下一個節點以建立 DAG 流程。',
    footer: 'MatrixFlow AI · 可靠的跨境電商自動化核心引擎',
    nodes: {
      trigger: '手動觸發器 (Trigger)',
      triggerDesc: '作為流程起點接收初始參數。',
      ai: 'AI 模型節點',
      aiDesc: '呼叫已設定的 AI Provider 產生內容或執行分類。',
      transform: '資料轉換節點 (Transform)',
      transformDesc: '將上游節點輸出格式化為目標資料。',
      condition: '條件分支節點 (Condition)',
      conditionDesc: '依據條件運算式路由至不同輸出路徑。',
    },
    prompts: {
      product_title: '商品標題 (product_title)',
      product_listing: 'Listing 頁面 (product_listing)',
      product_faq: '商品 FAQ 問答 (product_faq)',
      tiktok_script: 'TikTok 帶貨腳本 (tiktok_script)',
      instagram_caption: 'Instagram 種草圖文 (instagram_caption)',
      facebook_ad: 'Facebook 廣告投放 (facebook_ad)',
      email_marketing: 'EDM 電子郵件行銷 (email_marketing)',
      seo_blog: 'SEO 部落格文章 (seo_blog)',
      customer_service_reply: '智慧客服回覆 (customer_service_reply)',
      negative_review_reply: '差評應對公關 (negative_review_reply)',
      multilingual_translate: '多語言翻譯 (multilingual_translate)',
      brand_voice_rewrite: '品牌語氣潤飾 (brand_voice_rewrite)',
    },
  },
  en: {
    workflows: 'Workflows',
    back: 'Back to workflows',
    editorFallback: 'Workflow editor',
    loading: 'Loading…',
    currentVersion: (version: number) => `Current version: v${version}`,
    editorHint: 'Drag nodes or handles to build a visual flow',
    delete: 'Delete',
    cancel: 'Cancel',
    deleteConfirm: 'Delete this workflow, all versions, and run history?',
    history: 'Run history',
    save: 'Save config',
    saving: 'Saving…',
    run: 'Run',
    running: 'Running…',
    runSubmitted: (status: string, runId: string) =>
      `Workflow submitted. Status: ${status}; run ID: ${runId}`,
    saved: 'Workflow configuration saved.',
    saveFailed: (message: string) => `Save failed: ${message}`,
    deleted: 'Workflow, versions, and run history deleted',
    deleteFailed: 'Could not delete workflow',
    configured: 'Configured',
    unconfigured: 'Not configured',
    nodeCached: 'Node properties are staged on the canvas. Click “Save config” to commit them.',
    changedAt: (time: string) => `Visual configuration updated at ${time}`,
    properties: 'Edit properties',
    nodeId: 'Node identifier (ID)',
    promptTemplate: 'AI prompt template (Prompt Key)',
    choosePrompt: '-- Choose a prompt template --',
    recipient: 'Notification recipient (Email Address)',
    recipientPlaceholder: 'e.g. boss@company.com',
    subject: 'Email subject',
    subjectPlaceholder: 'Workflow execution result',
    body: 'Email body template',
    bodyPlaceholder: 'Execution result: {{input}}',
    webhook: 'Webhook URL',
    webhookPlaceholder: 'e.g. https://api.mycrm.com/v1/leads',
    transform: 'Transform template (JSON/Txt Template)',
    transformPlaceholder: 'e.g. convert {{ai.content}} to text…',
    field: 'Comparison field path',
    fieldPlaceholder: 'e.g. score',
    operator: 'Comparison operator',
    value: 'Expected value',
    valuePlaceholder: 'e.g. 0.8',
    conditionHint: 'The first outgoing edge is true; the second outgoing edge is false.',
    triggerHint:
      'Manual triggers need no extra configuration. The next connected node receives the initial input.',
    deleteNode: 'Delete node',
    apply: 'Apply changes',
    addNode: 'Add a node to the canvas',
    helpTitle: 'How do I configure and connect nodes?',
    helpOne: 'Select a node and configure its properties in this panel.',
    helpTwo: 'Drag a handle from either side of a node to connect the next step in the DAG.',
    footer: 'MatrixFlow AI · A reliable automation engine for cross-border commerce',
    nodes: {
      trigger: 'Manual trigger (Trigger)',
      triggerDesc: 'Receives the initial payload at the start of the flow.',
      ai: 'AI model node',
      aiDesc: 'Calls the configured AI provider to generate or classify content.',
      transform: 'Data transform node (Transform)',
      transformDesc: 'Formats upstream output into the target data shape.',
      condition: 'Conditional branch node (Condition)',
      conditionDesc: 'Routes execution using a condition expression.',
    },
    prompts: {
      product_title: 'Product title (product_title)',
      product_listing: 'Product listing (product_listing)',
      product_faq: 'Product FAQ answers (product_faq)',
      tiktok_script: 'TikTok commerce script (tiktok_script)',
      instagram_caption: 'Instagram caption (instagram_caption)',
      facebook_ad: 'Facebook ad (facebook_ad)',
      email_marketing: 'EDM email marketing (email_marketing)',
      seo_blog: 'SEO blog post (seo_blog)',
      customer_service_reply: 'Customer support reply (customer_service_reply)',
      negative_review_reply: 'Negative review response (negative_review_reply)',
      multilingual_translate: 'Multilingual translation (multilingual_translate)',
      brand_voice_rewrite: 'Brand voice rewrite (brand_voice_rewrite)',
    },
  },
} satisfies Record<
  Locale,
  {
    workflows: string;
    back: string;
    editorFallback: string;
    loading: string;
    currentVersion: (version: number) => string;
    editorHint: string;
    delete: string;
    cancel: string;
    deleteConfirm: string;
    history: string;
    save: string;
    saving: string;
    run: string;
    running: string;
    runSubmitted: (status: string, runId: string) => string;
    saved: string;
    saveFailed: (message: string) => string;
    deleted: string;
    deleteFailed: string;
    configured: string;
    unconfigured: string;
    nodeCached: string;
    changedAt: (time: string) => string;
    properties: string;
    nodeId: string;
    promptTemplate: string;
    choosePrompt: string;
    recipient: string;
    recipientPlaceholder: string;
    subject: string;
    subjectPlaceholder: string;
    body: string;
    bodyPlaceholder: string;
    webhook: string;
    webhookPlaceholder: string;
    transform: string;
    transformPlaceholder: string;
    field: string;
    fieldPlaceholder: string;
    operator: string;
    value: string;
    valuePlaceholder: string;
    conditionHint: string;
    triggerHint: string;
    deleteNode: string;
    apply: string;
    addNode: string;
    helpTitle: string;
    helpOne: string;
    helpTwo: string;
    footer: string;
    nodes: Record<
      | 'trigger'
      | 'ai'
      | 'transform'
      | 'condition'
      | 'triggerDesc'
      | 'aiDesc'
      | 'transformDesc'
      | 'conditionDesc',
      string
    >;
    prompts: Record<string, string>;
  }
>;

const PROMPT_KEYS = [
  'product_title',
  'product_listing',
  'product_faq',
  'tiktok_script',
  'instagram_caption',
  'facebook_ad',
  'email_marketing',
  'seo_blog',
  'customer_service_reply',
  'negative_review_reply',
  'multilingual_translate',
  'brand_voice_rewrite',
] as const;

export default function WorkflowEditorPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { locale } = useLocale();
  const copy = EDITOR_COPY[locale];
  const nodeTypes: Array<{ type: WorkflowNode['type']; label: string; desc: string }> = [
    { type: 'trigger', label: copy.nodes.trigger, desc: copy.nodes.triggerDesc },
    { type: 'ai', label: copy.nodes.ai, desc: copy.nodes.aiDesc },
    { type: 'transform', label: copy.nodes.transform, desc: copy.nodes.transformDesc },
    { type: 'condition', label: copy.nodes.condition, desc: copy.nodes.conditionDesc },
  ];
  const [mounted, setMounted] = useState(false);

  // ReactFlow Nodes and Edges State
  const [nodes, setNodes, onNodesChange] = useNodesState<EditorNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<EditorEdgeData>([]);
  const [selectedNode, setSelectedNode] = useState<EditorNode | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

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
            label: `${node.type.toUpperCase()}: ${configLabel(node.config) || copy.unconfigured}`,
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
  }, [copy.unconfigured, wf, setNodes, setEdges]);

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
    onSuccess: (result) => toast.success(copy.runSubmitted(result.status, result.runId)),
  });

  // Save new workflow DSL version back to database
  const saveMutation = useMutation({
    mutationFn: (body: { dsl: WorkflowDSL; changeNote: string }) =>
      apiClient.post(`/workflows/${id}/versions`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wf', id] });
      toast.success(copy.saved);
    },
    onError: (error: unknown) => {
      toast.error(copy.saveFailed(errorMessage(error)));
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => apiClient.del(`/workflows/${id}`),
    onSuccess: () => {
      toast.success(copy.deleted);
      setDeleteConfirmOpen(false);
      router.push('/dashboard/workflows');
    },
    onError: (error: unknown) => toast.error(errorMessage(error, copy.deleteFailed)),
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
        label: `${type.toUpperCase()}: ${copy.unconfigured}`,
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
          const labelText = configLabel(editConfig) || copy.configured;
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
    toast.success(copy.nodeCached);
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
      changeNote: copy.changedAt(new Date().toLocaleTimeString()),
    });
  };

  if (!mounted) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-5">
          <h1 className="text-xl font-bold tracking-tight">{copy.workflows}</h1>
        </div>
        <div className="surface-card">
          <PageLoader label={copy.loading} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-140px)] flex-col space-y-5 animate-fade-in lg:h-[calc(100vh-140px)]">
      {/* Editor Top Bar */}
      <div className="flex shrink-0 flex-col items-start justify-between gap-3 border-b border-border/40 pb-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => router.push('/dashboard/workflows')}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={copy.back}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{wf?.name ?? copy.editorFallback}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {copy.currentVersion(wf?.currentVersion ?? 1)} · {copy.editorHint}
            </p>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" /> {copy.delete}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => router.push(`/dashboard/workflows/${id}/runs`)}
          >
            {copy.history}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs border-primary/20 text-primary hover:bg-primary/5 gap-1.5"
            onClick={handleSaveWorkflow}
            disabled={saveMutation.isPending}
          >
            <Save className="h-3.5 w-3.5" /> {saveMutation.isPending ? copy.saving : copy.save}
          </Button>
          <Button
            size="sm"
            className="text-xs gap-1.5 shadow-glow-sm hover:shadow-glow"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
          >
            <Play className="h-3.5 w-3.5 fill-current" />{' '}
            {runMutation.isPending ? copy.running : copy.run}
          </Button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex min-h-0 grow flex-col gap-4 lg:flex-row">
        {/* Canvas Area */}
        <div className="surface-card relative min-h-[420px] flex-1 overflow-hidden lg:min-h-0">
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
            <Background color="hsl(var(--border))" gap={20} size={1} />
            <Controls className="bg-card text-foreground border-border fill-current" />
            <MiniMap
              nodeColor="#1e293b"
              maskColor="rgba(0, 0, 0, 0.5)"
              className="bg-card border border-border rounded-lg"
            />
          </ReactFlow>
        </div>

        {/* Properties / Nodes Control Sidebar */}
        <div className="surface-card max-h-[50vh] w-full shrink-0 overflow-y-auto p-5 lg:max-h-none lg:w-[320px]">
          {selectedNode ? (
            /* Selected Node Properties Editor */
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-sm font-bold flex items-center gap-1.5 text-primary">
                  <Settings2 className="h-4 w-4" /> {copy.properties}
                </h3>
                <span className="rounded-lg bg-muted px-2 py-0.5 text-2xs font-semibold uppercase text-muted-foreground">
                  {selectedNode.data?.rawNode?.type}
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{copy.nodeId}</Label>
                <Input value={selectedNode.id} disabled className="bg-muted/40 font-mono text-xs" />
              </div>

              {/* Node specific configs */}
              {selectedNode.data?.rawNode?.type === 'ai' && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">{copy.promptTemplate}</Label>
                  <Select
                    value={configText(editConfig, 'promptKey')}
                    onChange={(e) => setEditConfig({ ...editConfig, promptKey: e.target.value })}
                  >
                    <option value="" disabled>
                      {copy.choosePrompt}
                    </option>
                    {PROMPT_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {copy.prompts[key]}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {selectedNode.data?.rawNode?.type === 'email' && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">{copy.recipient}</Label>
                  <Input
                    type="email"
                    value={configText(editConfig, 'to')}
                    onChange={(e) => setEditConfig({ ...editConfig, to: e.target.value })}
                    placeholder={copy.recipientPlaceholder}
                    className="text-sm bg-muted/10 border-border/60 focus-visible:ring-primary/30"
                  />
                  <Label className="text-xs font-semibold">{copy.subject}</Label>
                  <Input
                    value={configText(editConfig, 'subject')}
                    onChange={(e) => setEditConfig({ ...editConfig, subject: e.target.value })}
                    placeholder={copy.subjectPlaceholder}
                    className="text-sm bg-muted/10 border-border/60 focus-visible:ring-primary/30"
                  />
                  <Label className="text-xs font-semibold">{copy.body}</Label>
                  <Textarea
                    value={configText(editConfig, 'body')}
                    onChange={(e) => setEditConfig({ ...editConfig, body: e.target.value })}
                    placeholder={copy.bodyPlaceholder}
                    rows={4}
                  />
                </div>
              )}

              {selectedNode.data?.rawNode?.type === 'webhook' && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">{copy.webhook}</Label>
                  <Input
                    type="url"
                    value={configText(editConfig, 'url')}
                    onChange={(e) => setEditConfig({ ...editConfig, url: e.target.value })}
                    placeholder={copy.webhookPlaceholder}
                    className="text-sm bg-muted/10 border-border/60 focus-visible:ring-primary/30"
                  />
                </div>
              )}

              {selectedNode.data?.rawNode?.type === 'transform' && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">{copy.transform}</Label>
                  <Textarea
                    value={configText(editConfig, 'template')}
                    onChange={(e) => setEditConfig({ ...editConfig, template: e.target.value })}
                    placeholder={copy.transformPlaceholder}
                    rows={4}
                  />
                </div>
              )}

              {selectedNode.data?.rawNode?.type === 'condition' && (
                <div className="space-y-3">
                  <Label className="text-xs font-semibold">{copy.field}</Label>
                  <Input
                    value={configText(editConfig, 'field')}
                    onChange={(e) => setEditConfig({ ...editConfig, field: e.target.value })}
                    placeholder={copy.fieldPlaceholder}
                    className="text-sm bg-muted/10 border-border/60 focus-visible:ring-primary/30"
                  />
                  <Label className="text-xs font-semibold">{copy.operator}</Label>
                  <Select
                    value={configText(editConfig, 'operator') || 'eq'}
                    onChange={(e) => setEditConfig({ ...editConfig, operator: e.target.value })}
                  >
                    {['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'truthy'].map(
                      (operator) => (
                        <option key={operator} value={operator}>
                          {operator}
                        </option>
                      ),
                    )}
                  </Select>
                  <Label className="text-xs font-semibold">{copy.value}</Label>
                  <Input
                    value={configText(editConfig, 'value')}
                    onChange={(e) => setEditConfig({ ...editConfig, value: e.target.value })}
                    placeholder={copy.valuePlaceholder}
                    className="text-sm bg-muted/10 border-border/60 focus-visible:ring-primary/30"
                  />
                  <p className="text-2xs text-muted-foreground">{copy.conditionHint}</p>
                </div>
              )}

              {selectedNode.data?.rawNode?.type === 'trigger' && (
                <p className="text-xs text-muted-foreground leading-normal">{copy.triggerHint}</p>
              )}

              <div className="flex gap-2 pt-3 border-t border-border/60">
                <Button
                  variant="destructive"
                  size="sm"
                  className="grow text-xs gap-1"
                  onClick={deleteNode}
                >
                  <Trash2 className="h-3.5 w-3.5" /> {copy.deleteNode}
                </Button>
                <Button size="sm" className="grow text-xs" onClick={handleSaveNodeConfig}>
                  {copy.apply}
                </Button>
              </div>
            </div>
          ) : (
            /* Node Adding Tool Box */
            <div className="space-y-5">
              <div className="border-b border-border pb-3">
                <h3 className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                  <Plus className="h-4 w-4 text-primary" /> {copy.addNode}
                </h3>
              </div>

              <div className="space-y-3.5">
                {nodeTypes.map((nt) => (
                  <button
                    key={nt.type}
                    onClick={() => addNode(nt.type)}
                    className="group w-full rounded-xl border border-border/60 bg-muted/10 p-3 text-left transition-[border-color,background-color,box-shadow] hover:border-primary/20 hover:bg-primary/5 hover:shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                        {nt.label}
                      </span>
                      <Plus className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <p className="mt-1 text-2xs leading-normal text-muted-foreground">{nt.desc}</p>
                  </button>
                ))}
              </div>

              <div className="flex gap-1.5 rounded-lg border border-border/40 bg-muted/30 p-3 text-2xs leading-relaxed text-muted-foreground">
                <HelpCircle className="h-4 w-4 shrink-0 text-primary/70" />
                <div>
                  <span className="font-bold text-foreground block mb-0.5">{copy.helpTitle}</span>
                  1. {copy.helpOne}
                  <br />
                  2. {copy.helpTwo}
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-border mt-6 shrink-0">
            <p className="text-center text-2xs text-muted-foreground">{copy.footer}</p>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={deleteConfirmOpen}
        title={copy.delete}
        description={copy.deleteConfirm}
        confirmLabel={copy.delete}
        cancelLabel={copy.cancel}
        busy={deleteMutation.isPending}
        onCancel={() => {
          if (!deleteMutation.isPending) setDeleteConfirmOpen(false);
        }}
        onConfirm={() => deleteMutation.mutate()}
      />
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
