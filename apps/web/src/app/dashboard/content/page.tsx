'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, type ListPage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Factory, Sparkles, Plus, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import type {
  ContentGenerationView,
  ContentItemSummary,
  ContentProjectSummary,
} from '@matrixflow/shared';
import { errorMessage } from '@/lib/errors';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';
import { PageHeader } from '@/components/ui/page';
import { EmptyState, ErrorState, LoadingCards } from '@/components/ui/states';
import { PaginationBar } from '@/components/ui/pagination';

const PROJECT_PAGE_SIZE = 12;

const CONTENT_TYPES = [
  {
    key: 'product_title',
    labels: { 'zh-CN': '商品标题', 'zh-TW': '商品標題', en: 'Product title' },
    icon: '🏷️',
    descriptions: {
      'zh-CN': '根据商品卖点自动生成吸引点击的电商标题',
      'zh-TW': '根據商品賣點自動生成吸引點擊的電商標題',
      en: 'Generate click-worthy commerce titles from product benefits',
    },
  },
  {
    key: 'listing',
    labels: { 'zh-CN': '商品详情页', 'zh-TW': '商品詳情頁', en: 'Product listing' },
    icon: '📄',
    descriptions: {
      'zh-CN': '标准的 Amazon/eBay 详情描述与五点描述',
      'zh-TW': '標準的 Amazon/eBay 詳情描述與五點描述',
      en: 'Amazon/eBay descriptions and five key selling points',
    },
  },
  {
    key: 'faq',
    labels: { 'zh-CN': 'FAQ 问答', 'zh-TW': 'FAQ 問答', en: 'FAQ answers' },
    icon: '❓',
    descriptions: {
      'zh-CN': '针对商品的常见疑难问题进行专业解答',
      'zh-TW': '針對商品常見疑難問題提供專業解答',
      en: 'Answer common product questions with confidence',
    },
  },
  {
    key: 'tiktok_script',
    labels: { 'zh-CN': 'TikTok 脚本', 'zh-TW': 'TikTok 腳本', en: 'TikTok script' },
    icon: '🎬',
    descriptions: {
      'zh-CN': '适合短视频传播的带货口播与分镜头脚本',
      'zh-TW': '適合短影音傳播的帶貨口播與分鏡腳本',
      en: 'Short-form video scripts with spoken lines and shots',
    },
  },
  {
    key: 'instagram',
    labels: { 'zh-CN': 'Instagram 文案', 'zh-TW': 'Instagram 文案', en: 'Instagram copy' },
    icon: '📸',
    descriptions: {
      'zh-CN': '配有热门标签与互动话题的社媒种草文案',
      'zh-TW': '搭配熱門標籤與互動話題的社群種草文案',
      en: 'Social copy with relevant hashtags and conversation hooks',
    },
  },
  {
    key: 'facebook_ad',
    labels: { 'zh-CN': 'Facebook 广告', 'zh-TW': 'Facebook 廣告', en: 'Facebook ad' },
    icon: '📢',
    descriptions: {
      'zh-CN': '高点击率的广告正文与吸睛标题组合',
      'zh-TW': '高點擊率的廣告正文與吸睛標題組合',
      en: 'High-click ad body copy and headline combinations',
    },
  },
  {
    key: 'email_marketing',
    labels: {
      'zh-CN': '邮件营销 (EDM)',
      'zh-TW': '電子郵件行銷 (EDM)',
      en: 'Email marketing (EDM)',
    },
    icon: '📧',
    descriptions: {
      'zh-CN': '针对新客转化或老客复购的营销推介信',
      'zh-TW': '針對新客轉換或舊客回購的行銷推介信',
      en: 'Promotional emails for conversion and repeat purchases',
    },
  },
  {
    key: 'seo_blog',
    labels: { 'zh-CN': 'SEO 博客文章', 'zh-TW': 'SEO 部落格文章', en: 'SEO blog post' },
    icon: '📝',
    descriptions: {
      'zh-CN': '以行业关键词为核心的深度软文与导购指南',
      'zh-TW': '以產業關鍵字為核心的深度軟文與導購指南',
      en: 'In-depth editorial and buying guides built around keywords',
    },
  },
  {
    key: 'customer_service',
    labels: { 'zh-CN': '客服话术', 'zh-TW': '客服話術', en: 'Support replies' },
    icon: '💬',
    descriptions: {
      'zh-CN': '包含售前引导、售后纠纷处理的快捷回复语',
      'zh-TW': '包含售前引導與售後爭議處理的快速回覆',
      en: 'Quick replies for presales guidance and after-sales cases',
    },
  },
  {
    key: 'landing_page',
    labels: { 'zh-CN': '营销落地页', 'zh-TW': '行銷落地頁', en: 'Marketing landing page' },
    icon: '🚀',
    descriptions: {
      'zh-CN': '符合消费心理学的单品落地页排版与文案',
      'zh-TW': '符合消費心理學的單品落地頁版型與文案',
      en: 'Landing-page structure and copy shaped by buyer psychology',
    },
  },
  {
    key: 'multilingual',
    labels: { 'zh-CN': '多语言翻译', 'zh-TW': '多語言翻譯', en: 'Multilingual translation' },
    icon: '🌍',
    descriptions: {
      'zh-CN': '针对本土文化优化的多语种地道翻译',
      'zh-TW': '針對在地文化優化的多語種道地翻譯',
      en: 'Natural translations adapted to local culture',
    },
  },
  {
    key: 'brand_voice',
    labels: { 'zh-CN': '品牌语气改写', 'zh-TW': '品牌語氣改寫', en: 'Brand voice rewrite' },
    icon: '🎨',
    descriptions: {
      'zh-CN': '按照特定调性（幽默、科技、奢华）重新包装',
      'zh-TW': '按照特定調性（幽默、科技、奢華）重新包裝',
      en: 'Repackage copy in a defined voice such as playful, technical, or premium',
    },
  },
];

export default function ContentFactoryPage() {
  const { locale } = useLocale();
  const copy = {
    'zh-CN': {
      eyebrow: '内容生产',
      title: '内容工厂',
      description: '智能批量产出适用于不同平台的电商宣发和社媒运营文案',
      create: '新建内容项目',
      quick: '快速新建项目',
      projectName: '项目名称',
      productDescription: '产品核心卖点/描述',
      projectPlaceholder: '例如：智能便携吸尘器推广',
      productPlaceholder: '例如：200W 大吸力、无线轻量、续航 45 分钟，适合宠物家庭。',
      cancel: '取消',
      creating: '正在创建…',
      createNow: '立即创建',
      select: '选择项目进行编辑',
      none: '暂无可用项目，请点击右上角新建项目。',
      choose: '暂未选择项目',
      generating: '智能矩阵流生成中，请耐心等候…',
      generateAll: '一键生成全部 12 类跨境文案矩阵',
      regenerate: '重新生成',
      output: 'AI 输出：',
      deleted: '内容项目已删除',
      deleteFailed: '内容项目删除失败',
      deleteProject: '删除内容项目',
      generatePartial: (completed: number, failed: number) =>
        `已完成 ${completed} 项，${failed} 项生成失败`,
      generateComplete: '12 类内容已全部生成',
      deleteConfirm: '确定删除该内容项目及其全部生成结果吗？',
      emptyProjectDescription: '选择上方已有项目或新建一个项目以启动 AI 员工的批量内容处理工厂。',
    },
    'zh-TW': {
      eyebrow: '內容生產',
      title: '內容工廠',
      description: '智慧批次產出適用於不同平台的電商宣傳與社群營運文案',
      create: '建立內容專案',
      quick: '快速建立專案',
      projectName: '專案名稱',
      productDescription: '產品核心賣點／描述',
      projectPlaceholder: '例如：智慧便攜吸塵器推廣',
      productPlaceholder: '例如：200W 大吸力、無線輕量、續航 45 分鐘，適合寵物家庭。',
      cancel: '取消',
      creating: '正在建立…',
      createNow: '立即建立',
      select: '選擇專案進行編輯',
      none: '暫無可用專案，請點擊右上角建立專案。',
      choose: '尚未選擇專案',
      generating: '智慧矩陣流生成中，請耐心等候…',
      generateAll: '一鍵生成全部 12 類跨境文案矩陣',
      regenerate: '重新生成',
      output: 'AI 輸出：',
      deleted: '內容專案已刪除',
      deleteFailed: '內容專案刪除失敗',
      deleteProject: '刪除內容專案',
      generatePartial: (completed: number, failed: number) =>
        `已完成 ${completed} 項，${failed} 項生成失敗`,
      generateComplete: '12 類內容已全部生成',
      deleteConfirm: '確定刪除此內容專案及其全部生成結果嗎？',
      emptyProjectDescription: '選擇上方已有專案或建立一個專案，以啟動 AI 員工的批次內容處理工廠。',
    },
    en: {
      eyebrow: 'Content operations',
      title: 'Content factory',
      description: 'Batch-produce commerce and social copy tailored to every platform',
      create: 'New content project',
      quick: 'Quickly create a project',
      projectName: 'Project name',
      productDescription: 'Product benefits / description',
      projectPlaceholder: 'e.g. Smart cordless vacuum campaign',
      productPlaceholder: 'e.g. 200W suction, lightweight cordless design, 45-minute battery life.',
      cancel: 'Cancel',
      creating: 'Creating…',
      createNow: 'Create now',
      select: 'Select a project to edit',
      none: 'No projects yet. Create one from the button above.',
      choose: 'No project selected',
      generating: 'Generating the content matrix…',
      generateAll: 'Generate all 12 content formats',
      regenerate: 'Regenerate',
      output: 'AI output:',
      deleted: 'Content project deleted',
      deleteFailed: 'Could not delete the content project',
      deleteProject: 'Delete content project',
      generatePartial: (completed: number, failed: number) =>
        `${completed} completed, ${failed} failed`,
      generateComplete: 'All 12 content formats generated',
      deleteConfirm: 'Delete this content project and all generated results?',
      emptyProjectDescription:
        'Select an existing project or create one to start batch processing with AI workers.',
    },
  }[locale];
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectOffset, setProjectOffset] = useState(0);
  const [generating, setGenerating] = useState<string | null>(null);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ContentGenerationView>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [productDesc, setProductDesc] = useState('');

  const {
    data: projectPage,
    isLoading: projectsLoading,
    isError: projectsError,
    isFetching: projectsFetching,
    refetch: refetchProjects,
  } = useQuery({
    queryKey: ['content-projects', projectOffset],
    queryFn: () =>
      apiClient.get<ListPage<ContentProjectSummary>>(
        `/content/projects?limit=${PROJECT_PAGE_SIZE}&offset=${projectOffset}`,
      ),
    placeholderData: (previous) => previous,
  });
  const projects = projectPage?.data;

  const { data: items, refetch: refetchItems } = useQuery({
    queryKey: ['content-items', projectId],
    queryFn: () => apiClient.get<ContentItemSummary[]>(`/content/projects/${projectId}/items`),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (Array.isArray(items)) {
      const mappedResults: Record<string, ContentGenerationView> = {};
      items.forEach((item) => {
        mappedResults[item.type] = {
          itemId: item.id,
          content: item.body?.parsed ?? item.body?.raw ?? '',
          usage: item.metadata?.usage,
          cost: item.metadata?.cost,
        };
      });
      setResults(mappedResults);
    } else {
      setResults({});
    }
  }, [items]);

  async function generate(type: string) {
    if (!projectId) return;
    setGenerating(type);
    try {
      await apiClient.post(`/content/projects/${projectId}/generate`, {
        type,
        variables: { language: 'en' },
      });
      await refetchItems();
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    } finally {
      setGenerating(null);
    }
  }

  async function generateAll() {
    if (!projectId) return;
    setGenerating('all');
    try {
      const result = await apiClient.post<{ completed: number; failed: number }>(
        `/content/projects/${projectId}/generate-all`,
        { language: 'en' },
      );
      await refetchItems();
      if (result.failed) toast.warning(copy.generatePartial(result.completed, result.failed));
      else toast.success(copy.generateComplete);
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    } finally {
      setGenerating(null);
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!projectName.trim()) return;
    setGenerating('create');
    try {
      const res = await apiClient.post<ContentProjectSummary>('/content/projects', {
        name: projectName,
        productData: { title: projectName, description: productDesc },
      });
      setProjectOffset(0);
      await queryClient.invalidateQueries({ queryKey: ['content-projects'] });
      setProjectId(res.id);
      setProjectName('');
      setProductDesc('');
      setIsCreating(false);
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    } finally {
      setGenerating(null);
    }
  }

  async function deleteProject(id: string) {
    setDeletingProjectId(id);
    try {
      await apiClient.del(`/content/projects/${id}`);
      if (projectId === id) setProjectId(null);
      if ((projects?.length ?? 0) === 1 && projectOffset > 0)
        setProjectOffset(Math.max(0, projectOffset - PROJECT_PAGE_SIZE));
      await queryClient.invalidateQueries({ queryKey: ['content-projects'] });
      toast.success(copy.deleted);
      setDeleteProjectId(null);
    } catch (error) {
      toast.error(errorMessage(error, copy.deleteFailed));
    } finally {
      setDeletingProjectId(null);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={
          <Button
            onClick={() => setIsCreating(!isCreating)}
            className="gap-1.5 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" /> {copy.create}
          </Button>
        }
      />

      {/* Create project inline-form */}
      {isCreating && (
        <form
          onSubmit={handleCreateProject}
          className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4 max-w-xl animate-slide-up"
        >
          <h3 className="text-sm font-bold flex items-center gap-1.5 text-primary">
            <Sparkles className="h-4 w-4" /> {copy.quick}
          </h3>
          <div className="space-y-1">
            <Label htmlFor="projName" className="text-2xs font-semibold">
              {copy.projectName}
            </Label>
            <Input
              id="projName"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder={copy.projectPlaceholder}
              required
              className="bg-background border-border/80 text-sm focus-visible:ring-primary/30"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="projDesc" className="text-2xs font-semibold">
              {copy.productDescription}
            </Label>
            <Textarea
              id="projDesc"
              value={productDesc}
              onChange={(e) => setProductDesc(e.target.value)}
              placeholder={copy.productPlaceholder}
              rows={3}
              className="min-h-20"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" type="button" onClick={() => setIsCreating(false)}>
              {copy.cancel}
            </Button>
            <Button size="sm" type="submit" disabled={generating === 'create'}>
              {generating === 'create' ? copy.creating : copy.createNow}
            </Button>
          </div>
        </form>
      )}

      {/* Project selector */}
      <div className="space-y-2">
        <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block">
          {copy.select}
        </span>
        {projectsLoading && <LoadingCards count={2} />}
        {projectsError && <ErrorState onRetry={() => void refetchProjects()} />}
        {!projectsLoading && !projectsError && (
          <div className="flex flex-wrap gap-2">
            {projects?.map((project) => (
              <span
                key={project.id}
                className={`inline-flex min-h-9 overflow-hidden rounded-xl border transition-[border-color,background-color,color,box-shadow] ${
                  projectId === project.id
                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                    : 'border-border/60 text-muted-foreground'
                }`}
              >
                <button
                  onClick={() => setProjectId(project.id)}
                  className="min-h-9 px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  {project.name}
                </button>
                <button
                  type="button"
                  aria-label={`${copy.deleteProject} ${project.name}`}
                  onClick={() => setDeleteProjectId(project.id)}
                  className="min-h-9 border-l border-current/10 px-2.5 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
            {(!projects || projects.length === 0) && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> {copy.none}
              </span>
            )}
          </div>
        )}
        {projectPage && (
          <PaginationBar
            offset={projectPage.offset}
            limit={projectPage.limit}
            total={projectPage.total}
            nextOffset={projectPage.nextOffset}
            busy={projectsFetching}
            onChange={(nextOffset) => {
              setProjectOffset(nextOffset);
              setProjectId(null);
            }}
          />
        )}
      </div>

      {!projectId && (
        <EmptyState icon={Factory} title={copy.choose} description={copy.emptyProjectDescription} />
      )}

      {projectId && (
        <div className="space-y-6 animate-slide-up">
          <div className="flex items-center gap-3 border-t border-border/40 pt-6">
            <Button onClick={generateAll} disabled={!!generating} className="gap-2 text-xs">
              {generating === 'all' ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {copy.generating}
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  {copy.generateAll}
                </>
              )}
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CONTENT_TYPES.map((ct) => (
              <div key={ct.key} className="surface-card flex flex-col justify-between p-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{ct.icon}</span>
                      <span className="text-sm font-bold text-foreground">{ct.labels[locale]}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => generate(ct.key)}
                      disabled={!!generating}
                      className="h-8 border-border/60 px-2.5 text-2xs hover:bg-muted"
                    >
                      {generating === ct.key ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        copy.regenerate
                      )}
                    </Button>
                  </div>
                  <p className="text-2xs text-muted-foreground leading-relaxed mb-4">
                    {ct.descriptions[locale]}
                  </p>
                </div>

                {results[ct.key] && (
                  <div className="mt-2 space-y-1">
                    <span className="text-2xs font-semibold uppercase text-muted-foreground">
                      {copy.output}
                    </span>
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-border/40 bg-muted/40 p-3 font-mono text-2xs leading-relaxed">
                      {formatContent(results[ct.key].content)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(deleteProjectId)}
        title={copy.deleteProject}
        description={copy.deleteConfirm}
        confirmLabel={copy.deleteProject}
        cancelLabel={copy.cancel}
        busy={Boolean(deletingProjectId)}
        onCancel={() => {
          if (!deletingProjectId) setDeleteProjectId(null);
        }}
        onConfirm={() => {
          if (deleteProjectId) void deleteProject(deleteProjectId);
        }}
      />
    </div>
  );
}

function formatContent(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}
