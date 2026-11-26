'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  skipToken,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiClient, type ListPage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  BookOpen,
  Check,
  Camera,
  CircleHelp,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  FileSpreadsheet,
  Folder,
  Languages,
  Loader2,
  ListChecks,
  Mail,
  Megaphone,
  MessageSquare,
  PenLine,
  Plus,
  Sparkles,
  SlidersHorizontal,
  Tag,
  Trash2,
  Video,
} from 'lucide-react';
import type { ContentItemSummary, ContentProjectSummary } from '@matrixflow/shared';
import { errorMessage } from '@/lib/errors';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';
import { ErrorState, LoadingCards } from '@/components/ui/states';
import { PaginationBar } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { JobProgress } from '@/components/job-progress';
import {
  ContentReview,
  savedDraft as persistedDraft,
  type ReviewDraft,
} from '@/components/content-review';
import { ShopifyTranslations } from '@/components/shopify-translations';
import { isActiveJob, type BackgroundJob } from '@/lib/jobs';

const PROJECT_PAGE_SIZE = 12;
const GENERATE_MUTATION = { mutationKey: ['content-generate'] } as const;
const DELETE_MUTATION = { mutationKey: ['content-delete'] } as const;

type TrackedJob = { id: string; active: boolean };
type ContentProject = ContentProjectSummary & {
  status?: string;
  productData?: { description?: string; factsRevision?: number };
};

function updateView(projectId: string | null, create: boolean, replace = false) {
  const url = new URL(window.location.href);
  if (projectId !== url.searchParams.get('project')) {
    url.searchParams.delete('view');
    url.searchParams.delete('translationJob');
  }
  if (projectId) url.searchParams.set('project', projectId);
  else url.searchParams.delete('project');
  if (create) url.searchParams.set('create', '1');
  else url.searchParams.delete('create');
  if (url.href === window.location.href) return;
  if (replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
}

function projectJobKey(projectId: string | null) {
  return ['content-project-job', projectId] as const;
}

const CONTENT_TYPES = [
  {
    key: 'product_title',
    labels: { 'zh-CN': '商品标题', 'zh-TW': '商品標題', en: 'Product title' },
    icon: Tag,
    descriptions: {
      'zh-CN': '根据商品卖点自动生成吸引点击的电商标题',
      'zh-TW': '根據商品賣點自動生成吸引點擊的電商標題',
      en: 'Generate click-worthy commerce titles from product benefits',
    },
  },
  {
    key: 'listing',
    labels: { 'zh-CN': '商品详情页', 'zh-TW': '商品詳情頁', en: 'Product listing' },
    icon: FileText,
    descriptions: {
      'zh-CN': '标准的 Amazon/eBay 详情描述与五点描述',
      'zh-TW': '標準的 Amazon/eBay 詳情描述與五點描述',
      en: 'Amazon/eBay descriptions and five key selling points',
    },
  },
  {
    key: 'faq',
    labels: { 'zh-CN': 'FAQ 问答', 'zh-TW': 'FAQ 問答', en: 'FAQ answers' },
    icon: CircleHelp,
    descriptions: {
      'zh-CN': '针对商品的常见疑难问题进行专业解答',
      'zh-TW': '針對商品常見疑難問題提供專業解答',
      en: 'Answer common product questions with confidence',
    },
  },
  {
    key: 'tiktok_script',
    labels: { 'zh-CN': 'TikTok 脚本', 'zh-TW': 'TikTok 腳本', en: 'TikTok script' },
    icon: Video,
    descriptions: {
      'zh-CN': '适合短视频传播的带货口播与分镜头脚本',
      'zh-TW': '適合短影音傳播的帶貨口播與分鏡腳本',
      en: 'Short-form video scripts with spoken lines and shots',
    },
  },
  {
    key: 'instagram',
    labels: { 'zh-CN': 'Instagram 文案', 'zh-TW': 'Instagram 文案', en: 'Instagram copy' },
    icon: Camera,
    descriptions: {
      'zh-CN': '配有热门标签与互动话题的社媒种草文案',
      'zh-TW': '搭配熱門標籤與互動話題的社群種草文案',
      en: 'Social copy with relevant hashtags and conversation hooks',
    },
  },
  {
    key: 'facebook_ad',
    labels: { 'zh-CN': 'Facebook 广告', 'zh-TW': 'Facebook 廣告', en: 'Facebook ad' },
    icon: Megaphone,
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
    icon: Mail,
    descriptions: {
      'zh-CN': '针对新客转化或老客复购的营销推介信',
      'zh-TW': '針對新客轉換或舊客回購的行銷推介信',
      en: 'Promotional emails for conversion and repeat purchases',
    },
  },
  {
    key: 'seo_blog',
    labels: { 'zh-CN': 'SEO 博客文章', 'zh-TW': 'SEO 部落格文章', en: 'SEO blog post' },
    icon: BookOpen,
    descriptions: {
      'zh-CN': '以行业关键词为核心的深度软文与导购指南',
      'zh-TW': '以產業關鍵字為核心的深度軟文與導購指南',
      en: 'In-depth editorial and buying guides built around keywords',
    },
  },
  {
    key: 'customer_service',
    labels: { 'zh-CN': '客服话术', 'zh-TW': '客服話術', en: 'Support replies' },
    icon: MessageSquare,
    descriptions: {
      'zh-CN': '包含售前引导、售后纠纷处理的快捷回复语',
      'zh-TW': '包含售前引導與售後爭議處理的快速回覆',
      en: 'Quick replies for presales guidance and after-sales cases',
    },
  },
  {
    key: 'landing_page',
    labels: { 'zh-CN': '营销落地页', 'zh-TW': '行銷落地頁', en: 'Marketing landing page' },
    icon: ClipboardList,
    descriptions: {
      'zh-CN': '符合消费心理学的单品落地页排版与文案',
      'zh-TW': '符合消費心理學的單品落地頁版型與文案',
      en: 'Landing-page structure and copy shaped by buyer psychology',
    },
  },
  {
    key: 'multilingual',
    labels: { 'zh-CN': '多语言翻译', 'zh-TW': '多語言翻譯', en: 'Multilingual translation' },
    icon: Languages,
    descriptions: {
      'zh-CN': '针对本土文化优化的多语种地道翻译',
      'zh-TW': '針對在地文化優化的多語種道地翻譯',
      en: 'Natural translations adapted to local culture',
    },
  },
  {
    key: 'brand_voice',
    labels: { 'zh-CN': '品牌语气改写', 'zh-TW': '品牌語氣改寫', en: 'Brand voice rewrite' },
    icon: PenLine,
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
      title: '内容工厂',
      description: '为商品起草多渠道文案、审核译文并导出。',
      create: '新建内容项目',
      quick: '快速新建项目',
      projectName: '项目名称',
      productDescription: '产品核心卖点/描述',
      projectPlaceholder: '例如：智能便携吸尘器推广',
      productPlaceholder: '例如：200W 大吸力、无线轻量、续航 45 分钟，适合宠物家庭。',
      cancel: '取消',
      creating: '正在创建…',
      createNow: '立即创建',
      select: '内容项目',
      none: '还没有内容项目。',
      generating: '智能矩阵流生成中，请耐心等候…',
      generateAll: '生成全部 12 种文案',
      regenerate: '重新生成',
      deleted: '内容项目已删除',
      deleteFailed: '内容项目删除失败',
      deleteProject: '删除内容项目',
      activeDelete: '请等待生成任务完成或取消后再删除此项目。',
      finishDelete: '删除已开始。请再次操作以完成清理。',
      deleteConfirm: '确定删除该内容项目及其全部生成结果吗？',
    },
    'zh-TW': {
      title: '內容工廠',
      description: '為商品準備多通路文案、審核譯文並匯出。',
      create: '建立內容專案',
      quick: '快速建立專案',
      projectName: '專案名稱',
      productDescription: '產品核心賣點／描述',
      projectPlaceholder: '例如：智慧便攜吸塵器推廣',
      productPlaceholder: '例如：200W 大吸力、無線輕量、續航 45 分鐘，適合寵物家庭。',
      cancel: '取消',
      creating: '正在建立…',
      createNow: '立即建立',
      select: '內容專案',
      none: '還沒有內容專案。',
      generating: '智慧矩陣流生成中，請耐心等候…',
      generateAll: '產生全部 12 種文案',
      regenerate: '重新生成',
      deleted: '內容專案已刪除',
      deleteFailed: '內容專案刪除失敗',
      deleteProject: '刪除內容專案',
      activeDelete: '請等待產生任務完成或取消後再刪除此專案。',
      finishDelete: '刪除已開始。請再次操作以完成清理。',
      deleteConfirm: '確定刪除此內容專案及其全部生成結果嗎？',
    },
    en: {
      title: 'Content factory',
      description: 'Write product copy, review translations and export approved content.',
      create: 'New project',
      quick: 'Quickly create a project',
      projectName: 'Project name',
      productDescription: 'Product benefits / description',
      projectPlaceholder: 'e.g. Smart cordless vacuum campaign',
      productPlaceholder: 'e.g. 200W suction, lightweight cordless design, 45-minute battery life.',
      cancel: 'Cancel',
      creating: 'Creating…',
      createNow: 'Create now',
      select: 'Projects',
      none: 'No content projects yet.',
      generating: 'Generating the content matrix…',
      generateAll: 'Generate all 12',
      regenerate: 'Regenerate',
      deleted: 'Content project deleted',
      deleteFailed: 'Could not delete the content project',
      deleteProject: 'Delete content project',
      activeDelete:
        'Wait for generation to finish or cancel the task before deleting this project.',
      finishDelete: 'Deletion has started. Retry to finish removing this project.',
      deleteConfirm: 'Delete this content project and all generated results?',
    },
  }[locale];
  const workspace = {
    'zh-CN': {
      formats: '商品文案',
      reference: '资料与核对',
      switchProject: '切换项目',
      noFacts: '没有可核对的商品资料。',
      groups: ['商品页面', '推广与社媒', '客服与本地化'],
      translations: 'Shopify 翻译',
      kind: '文案类型',
      moreFormats: '更多类型',
      noDraft: '此类型还没有草稿。',
      settings: '生成设置',
      brief: '商品资料',
      history: '生成记录',
      latest: '最新版本',
      approved: '已审核',
      draft: '待审核',
      pending: '正在生成',
    },
    'zh-TW': {
      formats: '商品文案',
      reference: '資料與核對',
      switchProject: '切換專案',
      noFacts: '沒有可核對的商品資料。',
      groups: ['商品頁面', '推廣與社群', '客服與在地化'],
      translations: 'Shopify 翻譯',
      kind: '文案類型',
      moreFormats: '更多類型',
      noDraft: '此類型尚無草稿。',
      settings: '產生設定',
      brief: '商品資料',
      history: '生成紀錄',
      latest: '最新版本',
      approved: '已審核',
      draft: '待審核',
      pending: '正在產生',
    },
    en: {
      formats: 'Product copy',
      reference: 'Review references',
      switchProject: 'Switch project',
      noFacts: 'No product facts were added.',
      groups: ['Listing', 'Marketing', 'Support & localization'],
      translations: 'Shopify translations',
      kind: 'Content format',
      moreFormats: 'More formats',
      noDraft: 'No draft for this format yet.',
      settings: 'Generation settings',
      brief: 'Product brief',
      history: 'Generation history',
      latest: 'Latest',
      approved: 'Approved',
      draft: 'In review',
      pending: 'Generating',
    },
  }[locale];
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project');
  const isCreating = searchParams.get('create') === '1';
  const isTranslations = searchParams.get('view') === 'translations';
  const translationJob = searchParams.get('translationJob');
  const [factsEditor, setFactsEditor] = useState<{
    id: string;
    description: string;
    revision: number;
  } | null>(null);
  const factsCopy = {
    en: {
      edit: 'Edit product facts',
      label: 'Product facts',
      save: 'Save product facts',
      saved: 'Product facts updated',
      outdated: 'Out of date',
      stale: 'Facts have changed. Regenerate this draft before approving or exporting it.',
    },
    'zh-CN': {
      edit: '编辑商品资料',
      label: '商品资料',
      save: '保存商品资料',
      saved: '商品资料已更新',
      outdated: '旧稿',
      stale: '商品资料已更新。请重新生成文案，再审核和导出。',
    },
    'zh-TW': {
      edit: '編輯商品資料',
      label: '商品資料',
      save: '儲存商品資料',
      saved: '商品資料已更新',
      outdated: '舊稿',
      stale: '商品資料已更新。請重新產生文案，再審核和匯出。',
    },
  }[locale];
  const projectPicker = useRef<HTMLDetailsElement>(null);
  const generationSettings = useRef<HTMLDetailsElement>(null);
  const [projectOffset, setProjectOffset] = useState(0);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  useEffect(() => {
    const dismissOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || deleteProjectId) return;
      for (const disclosure of [projectPicker.current, generationSettings.current]) {
        if (disclosure?.open && !disclosure.contains(event.target)) disclosure.open = false;
      }
    };
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [deleteProjectId]);

  const [formats, setFormats] = useState<Record<string, string>>({});
  const [versions, setVersions] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState(() => new Map<string, ReviewDraft>());
  const { data: projectJob } = useQuery<TrackedJob>({
    queryKey: projectJobKey(projectId),
    queryFn: skipToken,
    gcTime: Infinity,
  });
  const [language, setLanguage] = useState('en');
  const [market, setMarket] = useState('');
  const [tone, setTone] = useState('');
  const controls = {
    'zh-CN': {
      language: '输出语言',
      market: '目标市场',
      marketHint: '例如：美国 / Amazon',
      tone: '文风与受众',
      toneHint: '例如：简洁友好，面向新手',
      loading: '正在加载已保存的稿件…',
      generate: '生成',
      productHint: '填写材质、尺寸、卖点与限制等已确认事实；信息不足的部分会标注待补充。',
    },
    'zh-TW': {
      language: '輸出語言',
      market: '目標市場',
      marketHint: '例如：美國 / Amazon',
      tone: '文風與受眾',
      toneHint: '例如：簡潔友善，面向新手',
      loading: '正在載入歷史內容…',
      generate: '產生',
      productHint: '填寫材質、尺寸、賣點與限制等已確認事實；資訊不足的部分會標示待補充。',
    },
    en: {
      language: 'Output language',
      market: 'Target market',
      marketHint: 'e.g. US / Amazon',
      tone: 'Tone and audience',
      toneHint: 'e.g. Friendly and concise',
      loading: 'Loading saved content…',
      generate: 'Generate',
      productHint:
        'Include confirmed materials, dimensions, benefits and limitations. Missing information will be marked for completion.',
    },
  }[locale];
  const [projectName, setProjectName] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [knowledgeBaseId, setKnowledgeBaseId] = useState('');
  const knowledge = useQuery({
    queryKey: ['content-knowledge-options'],
    queryFn: ({ signal }) =>
      apiClient.get<ListPage<{ id: string; name: string }>>('/kb?view=options&limit=100', {
        signal,
      }),
    enabled: isCreating,
  });
  const flow =
    locale === 'en'
      ? {
          kb: 'Knowledge base (optional)',
          loadingSources: 'Loading source libraries…',
          none: 'Use product facts only',
          add: 'Manage source documents',
          sample: 'Try sample product',
        }
      : locale === 'zh-TW'
        ? {
            kb: '關聯知識庫（選填）',
            loadingSources: '正在載入來源知識庫…',
            none: '僅使用商品資料',
            add: '管理來源文件',
            sample: '填入示例商品',
          }
        : {
            kb: '关联知识库（选填）',
            loadingSources: '正在加载来源知识库…',
            none: '仅使用商品资料',
            add: '管理来源文档',
            sample: '填入示例商品',
          };

  const {
    data: projectPage,
    isLoading: projectsLoading,
    isError: projectsError,
    isFetching: projectsFetching,
    refetch: refetchProjects,
  } = useQuery({
    queryKey: ['content-projects', projectOffset],
    queryFn: ({ signal }) =>
      apiClient.get<ListPage<ContentProject>>(
        `/content/projects?limit=${PROJECT_PAGE_SIZE}&offset=${projectOffset}`,
        { signal },
      ),
    placeholderData: (previous) => previous,
  });
  const projects = projectPage?.data;
  const listedProject = projects?.find((project) => project.id === projectId);
  const projectDetails = useQuery({
    queryKey: ['content-project', projectId],
    queryFn: ({ signal }) =>
      apiClient.get<ContentProject>(`/content/projects/${encodeURIComponent(projectId ?? '')}`, {
        signal,
      }),
    enabled: Boolean(projectId && !listedProject),
  });
  const selectedProject = listedProject ?? projectDetails.data;
  const projectDeleting = selectedProject?.status === 'DELETING';
  const savedFactsRevision = selectedProject?.productData?.factsRevision ?? 0;
  const factsRevision =
    Number.isSafeInteger(savedFactsRevision) && savedFactsRevision >= 0 ? savedFactsRevision : 0;
  const editingFacts = factsEditor?.id === projectId ? factsEditor : null;
  const saveFacts = useMutation({
    mutationFn: ({ id, description, revision }: NonNullable<typeof factsEditor>) =>
      apiClient.put<ContentProject>(`/content/projects/${encodeURIComponent(id)}/facts`, {
        description,
        revision,
      }),
    onSuccess: async (project) => {
      await queryClient.cancelQueries({ queryKey: ['content-projects'] });
      await queryClient.cancelQueries({ queryKey: ['content-project', project.id] });
      queryClient.setQueryData(['content-project', project.id], project);
      queryClient.setQueriesData<ListPage<ContentProject>>(
        { queryKey: ['content-projects'] },
        (page) =>
          page && {
            ...page,
            data: page.data.map((item) => (item.id === project.id ? project : item)),
          },
      );
      setFactsEditor((current) => (current?.id === project.id ? null : current));
      toast.success(factsCopy.saved);
    },
    onError: (error, input) => {
      void queryClient.invalidateQueries({ queryKey: ['content-projects'] });
      void queryClient.invalidateQueries({ queryKey: ['content-project', input.id] });
      toast.error(errorMessage(error, undefined, locale));
    },
  });

  const {
    data: items,
    isLoading: itemsLoading,
    isError: itemsError,
    refetch: refetchItems,
  } = useQuery({
    queryKey: ['content-items', projectId],
    queryFn: ({ signal }) =>
      apiClient.get<ContentItemSummary[]>(
        `/content/projects/${encodeURIComponent(projectId ?? '')}/items`,
        { signal },
      ),
    enabled: !!projectId && !projectDeleting,
  });

  const results = useMemo(() => {
    const latestByType = new Map<string, ContentItemSummary[]>();
    for (const item of items ?? []) {
      const history = latestByType.get(item.type);
      if (history) history.push(item);
      else latestByType.set(item.type, [item]);
    }
    return latestByType;
  }, [items]);

  const generate = useMutation({
    ...GENERATE_MUTATION,
    mutationFn: ({
      id,
      type,
      language,
      variables,
    }: {
      id: string;
      type?: string;
      language: string;
      variables: { targetMarket: string; tone: string };
    }) =>
      apiClient.post<BackgroundJob>(
        `/content/projects/${encodeURIComponent(id)}/${type ? 'generate' : 'generate-all'}`,
        {
          mode: 'async',
          type,
          language,
          variables,
        },
      ),
    onSuccess: (job, { id }) => {
      queryClient.setQueryData(['job', job.id], job);
      const active = isActiveJob(job);
      queryClient.setQueryData(projectJobKey(id), { id: job.id, active });
      if (!active) void queryClient.invalidateQueries({ queryKey: ['content-items', id] });
    },
  });
  const generating = generate.isPending ? generate.variables : undefined;
  const generationStarting = Boolean(useIsMutating(GENERATE_MUTATION));

  const createProject = useMutation({
    mutationFn: ({
      name,
      description,
      source,
    }: {
      name: string;
      description: string;
      source: string;
    }) =>
      apiClient.post<ContentProjectSummary>('/content/projects', {
        name,
        productData: {
          title: name,
          description,
          ...(source ? { knowledgeBaseId: source } : {}),
        },
      }),
    onSuccess: (project) => {
      queryClient.setQueryData(['content-project', project.id], project);
      void queryClient.invalidateQueries({ queryKey: ['content-projects'] });
    },
  });

  const deleteProject = useMutation({
    ...DELETE_MUTATION,
    mutationFn: async (id: string) => {
      const tracked = queryClient.getQueryData<TrackedJob>(projectJobKey(id));
      if (tracked?.active && !(id === projectId && projectDeleting)) {
        const job = await apiClient.get<BackgroundJob>(`/jobs/${encodeURIComponent(tracked.id)}`);
        queryClient.setQueryData(['job', job.id], job);
        if (isActiveJob(job)) return false;
      }
      await apiClient.del(`/content/projects/${encodeURIComponent(id)}`);
      return true;
    },
    onSuccess: async (deleted, id) => {
      if (!deleted) return;
      await queryClient.cancelQueries({ queryKey: ['content-projects'] });
      queryClient.setQueriesData<ListPage<ContentProject>>(
        { queryKey: ['content-projects'] },
        (page) => page && { ...page, data: page.data.filter((project) => project.id !== id) },
      );
      queryClient.removeQueries({ queryKey: ['content-project', id] });
      queryClient.removeQueries({ queryKey: ['content-items', id] });
      queryClient.removeQueries({ queryKey: projectJobKey(id) });
      void queryClient.invalidateQueries({ queryKey: ['content-projects'] });
    },
  });
  const deleting = Boolean(useIsMutating(DELETE_MUTATION));

  function handleCreateProject(event: React.FormEvent) {
    event.preventDefault();
    const name = projectName.trim();
    if (!name || createProject.isPending) return;
    const sourceUrl = window.location.href;
    createProject.mutate(
      { name, description: productDesc.trim(), source: knowledgeBaseId },
      {
        onSuccess: (project) => {
          setProjectName('');
          setProductDesc('');
          setKnowledgeBaseId('');
          if (window.location.href !== sourceUrl) return;
          setProjectOffset(0);
          updateView(project.id, false, true);
        },
        onError: (error) => toast.error(errorMessage(error, undefined, locale)),
      },
    );
  }

  function handleDeleteProject(id: string) {
    if (deleting || generationStarting) return;
    deleteProject.mutate(id, {
      onSuccess: (deleted) => {
        if (!deleted) {
          setDeleteProjectId(null);
          updateView(id, false);
          toast.error(copy.activeDelete);
          return;
        }
        const params = new URLSearchParams(window.location.search);
        if (params.get('project') === id) updateView(null, params.get('create') === '1', true);
        setDrafts((current) => {
          const next = new Map(current);
          for (const key of next.keys()) if (key.startsWith(id + '/')) next.delete(key);
          return next;
        });
        if (projects?.length === 1 && projects[0].id === id)
          setProjectOffset((offset) =>
            offset === projectPage?.offset ? Math.max(0, offset - PROJECT_PAGE_SIZE) : offset,
          );
        setDeleteProjectId(null);
        toast.success(copy.deleted);
      },
      onError: (error) => {
        void queryClient.invalidateQueries({ queryKey: ['content-projects'] });
        void queryClient.invalidateQueries({ queryKey: ['content-project', id] });
        toast.error(errorMessage(error, copy.deleteFailed, locale));
      },
    });
  }

  function switchPanel(translations: boolean) {
    const url = new URL(window.location.href);
    if (translations) url.searchParams.set('view', 'translations');
    else url.searchParams.delete('view');
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
  }

  function handleGenerate(type?: string) {
    if (!projectId || generationDisabled) return;
    const settings = generationSettings.current;
    if (settings?.open) {
      settings.open = false;
      if (!type) settings.querySelector('summary')?.focus();
    }
    generate.mutate(
      {
        id: projectId,
        type,
        language,
        variables: { targetMarket: market.trim(), tone: tone.trim() },
      },
      { onError: (error) => toast.error(errorMessage(error, undefined, locale)) },
    );
  }

  const generationDisabled =
    generationStarting || projectJob?.active || deleting || projectDeleting;
  const pendingFormat =
    generating && generating.id === projectId ? (generating.type ?? 'all') : null;

  const format =
    CONTENT_TYPES.find((entry) => entry.key === formats[projectId ?? '']) ??
    CONTENT_TYPES.find((entry) => results.has(entry.key)) ??
    CONTENT_TYPES[0];
  const history = results.get(format.key) ?? [];
  const historyKey = projectId + '/' + format.key;
  const result = history.find((item) => item.id === versions[historyKey]) ?? history[0];
  const draftKey = projectId + '/' + result?.id;
  const savedDraft = drafts.get(draftKey);
  const staleResult = Boolean(result && (result.metadata?.factsRevision ?? 0) !== factsRevision);
  const approved = Boolean(result?.body.review?.reviewed && !savedDraft && !staleResult);
  const generatingFormat = pendingFormat === format.key;
  const generateLabel = result ? copy.regenerate : controls.generate;
  const generateAction = (
    <Button
      type="button"
      size="sm"
      variant={result && !staleResult ? 'outline' : 'default'}
      disabled={generationDisabled || itemsLoading}
      aria-label={generatingFormat ? workspace.pending : generateLabel}
      title={generateLabel}
      onClick={() => handleGenerate(format.key)}
      className={cn(
        'rounded-md px-2.5 shadow-none transition-none backdrop-filter-none',
        staleResult
          ? 'h-9 min-h-10 sm:min-h-9 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100'
          : 'min-h-11 w-11 px-0 text-xs min-[380px]:w-auto min-[380px]:px-2.5',
        result && !staleResult && 'bg-card text-foreground',
      )}
    >
      {generatingFormat ? (
        <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        <Sparkles
          size={15}
          className={staleResult ? undefined : 'min-[380px]:hidden sm:block'}
          aria-hidden="true"
        />
      )}
      <span className={staleResult ? undefined : 'hidden min-[380px]:inline'}>{generateLabel}</span>
    </Button>
  );

  const reviewStatus = result && (
    <span
      className={cn(
        'w-fit shrink-0 rounded px-1.5 py-0.5 text-xs font-medium',
        staleResult
          ? 'bg-warning/10 text-amber-800 dark:text-amber-300'
          : approved
            ? 'bg-[#e6f4eb] text-[#176438] dark:bg-[#17372d] dark:text-[#a0edc0]'
            : 'bg-muted text-muted-foreground',
      )}
    >
      {staleResult ? factsCopy.outdated : approved ? workspace.approved : workspace.draft}
    </span>
  );

  const projectList = (
    <section aria-label={copy.select} className="min-w-0 overflow-hidden rounded-xl border bg-card">
      {projectId && (
        <h2 className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
          {copy.select}
        </h2>
      )}
      {projectsLoading && (
        <div className="p-3">
          <LoadingCards count={2} />
        </div>
      )}
      {projectsError && (
        <div className="p-3">
          <ErrorState onRetry={() => void refetchProjects()} />
        </div>
      )}
      {!projectsLoading &&
        !projectsError &&
        (projects?.length ? (
          <ul className={cn('divide-y', projectId && 'max-h-[55dvh] overflow-y-auto')}>
            {projects.map((project) => (
              <li key={project.id} className="flex min-w-0 items-center p-1 sm:px-2">
                <button
                  type="button"
                  aria-current={projectId === project.id ? 'true' : undefined}
                  title={project.name}
                  onClick={() => {
                    if (projectPicker.current) {
                      projectPicker.current.open = false;
                      projectPicker.current.querySelector('summary')?.focus();
                    }
                    updateView(project.id, false);
                  }}
                  className={cn(
                    'group flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 text-start text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    projectId ? 'min-h-11 py-1.5' : 'min-h-14 py-2 sm:px-3',
                    projectId === project.id && 'bg-primary/10 text-primary',
                  )}
                >
                  <span
                    className={cn(
                      'grid shrink-0 place-items-center rounded-md bg-primary/10 text-primary',
                      projectId ? 'size-7' : 'size-9',
                    )}
                  >
                    <Folder size={projectId ? 14 : 16} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{project.name}</span>
                  {projectId === project.id ? (
                    <Check size={15} className="shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronRight
                      size={16}
                      className="shrink-0 text-muted-foreground group-hover:text-primary"
                      aria-hidden="true"
                    />
                  )}
                </button>
                <button
                  type="button"
                  aria-label={`${copy.deleteProject} ${project.name}`}
                  disabled={generationStarting || deleting}
                  onClick={() => setDeleteProjectId(project.id)}
                  className="ms-1 grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-40"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-3 px-4 py-5 text-sm text-muted-foreground">
            <Folder size={18} className="shrink-0" aria-hidden="true" />
            <p>{copy.none}</p>
          </div>
        ))}
      {projectPage && (
        <div className="has-[nav]:p-2">
          <PaginationBar
            offset={projectPage.offset}
            limit={projectPage.limit}
            total={projectPage.total}
            nextOffset={projectPage.nextOffset}
            busy={projectsFetching}
            onChange={setProjectOffset}
          />
        </div>
      )}
    </section>
  );
  const description = selectedProject?.productData?.description;
  const facts = typeof description === 'string' ? description.trim() : '';
  const citations = result?.metadata?.citations ?? [];
  const detailedReferences =
    citations.length > 0 || facts.length > 180 || facts.split('\n').length > 3;
  const formatGroups = [
    ['product_title', 'listing', 'faq'],
    ['tiktok_script', 'instagram', 'facebook_ad', 'email_marketing', 'seo_blog', 'landing_page'],
    ['customer_service', 'multilingual', 'brand_voice'],
  ];
  const changeFormat = (key: string) => {
    if (projectId) setFormats((current) => ({ ...current, [projectId]: key }));
  };

  function formatButton(entry: (typeof CONTENT_TYPES)[number]) {
    const entryDraft = results.get(entry.key)?.[0];
    const entryStale = entryDraft && (entryDraft.metadata?.factsRevision ?? 0) !== factsRevision;
    const entryApproved = Boolean(
      entryDraft?.body.review?.reviewed &&
      !entryStale &&
      !drafts.has(projectId + '/' + entryDraft.id),
    );
    const state = entryStale
      ? factsCopy.outdated
      : entryApproved
        ? workspace.approved
        : workspace.draft;
    return (
      <button
        key={entry.key}
        type="button"
        aria-pressed={format.key === entry.key}
        onClick={() => changeFormat(entry.key)}
        className={`flex min-h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-start text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${format.key === entry.key ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}
      >
        <entry.icon size={15} className="shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{entry.labels[locale]}</span>
        {entryDraft && (
          <span title={state} aria-label={state} role="img" className="shrink-0">
            {entryApproved ? (
              <Check size={14} className="text-success" aria-hidden="true" />
            ) : (
              <span
                className={cn(
                  'block size-1.5 rounded-full',
                  entryStale ? 'bg-warning' : 'bg-current opacity-60',
                )}
              />
            )}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className={cn(
        'space-y-3 dark:[--primary:250_92%_75%] dark:[--primary-foreground:245_40%_16%] dark:[--ring:250_92%_75%]',
        !projectId && 'max-w-4xl space-y-4',
      )}
    >
      <header
        className={cn(
          'flex flex-wrap items-center justify-between gap-2',
          projectId ? 'border-b border-border pb-2.5' : 'gap-y-3',
        )}
      >
        <div
          className={cn(
            'min-w-0 flex-1',
            !projectId
              ? 'max-sm:basis-full sm:min-w-40'
              : !isTranslations && 'max-[499px]:basis-full',
          )}
        >
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-[-0.035em] [overflow-wrap:anywhere] max-[359px]:text-xl sm:text-[1.75rem]">
            {selectedProject && !projectDeleting
              ? selectedProject.name
              : projectId
                ? copy.title
                : copy.select}
          </h1>
          {!projectId && (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedProject && !projectDeleting && !isTranslations && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-md px-2.5 text-muted-foreground"
              aria-expanded={Boolean(editingFacts)}
              aria-controls={editingFacts ? 'edit-product-facts' : undefined}
              onClick={() => {
                setFactsEditor(
                  editingFacts
                    ? null
                    : {
                        id: selectedProject.id,
                        description: facts,
                        revision: factsRevision,
                      },
                );
              }}
            >
              <PenLine size={14} aria-hidden="true" />
              {factsCopy.edit}
            </Button>
          )}
          {selectedProject && !projectDeleting ? (
            <details
              ref={projectPicker}
              className="relative z-30 ms-auto"
              onKeyDown={(event) => {
                if (event.key === 'Escape' && event.currentTarget.open) {
                  event.stopPropagation();
                  event.currentTarget.open = false;
                  event.currentTarget.querySelector('summary')?.focus();
                }
              }}
            >
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                <Folder size={14} aria-hidden="true" />
                {workspace.switchProject}
                <ChevronDown size={14} aria-hidden="true" />
              </summary>
              <div className="absolute end-0 top-full mt-1 w-[min(17rem,calc(100vw-3rem))] rounded-xl shadow-xl">
                {projectList}
                <div className="mt-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full rounded-lg bg-card shadow-none"
                    aria-expanded={isCreating}
                    aria-controls={isCreating ? 'create-content-project' : undefined}
                    disabled={createProject.isPending}
                    onClick={() => {
                      if (projectPicker.current) {
                        projectPicker.current.open = false;
                        projectPicker.current.querySelector('summary')?.focus();
                      }
                      updateView(projectId, !isCreating);
                    }}
                  >
                    <Plus size={16} aria-hidden="true" />
                    {copy.create}
                  </Button>
                </div>
              </div>
            </details>
          ) : (
            <Button
              type="button"
              size={projectId ? 'default' : 'sm'}
              aria-expanded={isCreating}
              aria-controls={isCreating ? 'create-content-project' : undefined}
              disabled={createProject.isPending}
              onClick={() => updateView(projectId, !isCreating)}
              className="rounded-lg px-2.5 shadow-none sm:px-4"
            >
              <Plus className="size-4 max-[359px]:hidden" aria-hidden="true" /> {copy.create}
            </Button>
          )}
          {(!projectId || isCreating) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-lg px-2.5 text-muted-foreground sm:px-3"
              disabled={Boolean(
                createProject.isPending || projectName.trim() || productDesc.trim(),
              )}
              onClick={() => {
                updateView(projectId, true);
                setProjectName('Travel bag');
                setProductDesc(
                  'Capacity: 20 liters. Material: recycled polyester. Weight: 600 g. Warranty and waterproof rating: not provided.',
                );
              }}
            >
              {flow.sample}
            </Button>
          )}
        </div>
      </header>
      {editingFacts && !isTranslations && !projectDeleting && (
        <form
          id="edit-product-facts"
          className="max-w-2xl space-y-2 rounded-xl border bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!saveFacts.isPending) saveFacts.mutate(editingFacts);
          }}
        >
          <Label htmlFor="product-facts">{factsCopy.label}</Label>
          <Textarea
            id="product-facts"
            rows={4}
            maxLength={24000}
            className="text-base leading-[normal]"
            value={editingFacts.description}
            required
            disabled={saveFacts.isPending}
            onChange={(event) =>
              setFactsEditor({ ...editingFacts, description: event.target.value })
            }
          />
          {editingFacts.revision !== factsRevision && (
            <p role="status" className="text-sm text-warning">
              {errorMessage({ code: 'CONTENT_FACTS_CHANGED' }, undefined, locale)}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saveFacts.isPending}
              onClick={() => setFactsEditor(null)}
            >
              {copy.cancel}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                saveFacts.isPending ||
                !editingFacts.description.trim() ||
                editingFacts.revision !== factsRevision
              }
            >
              {factsCopy.save}
            </Button>
          </div>
        </form>
      )}
      {/* Create project inline-form */}
      {isCreating && (
        <form
          id="create-content-project"
          onSubmit={handleCreateProject}
          aria-busy={createProject.isPending}
          className="max-w-2xl space-y-4 rounded-xl border bg-card p-4 sm:p-6"
        >
          <h2 className="font-display text-lg font-semibold">{copy.quick}</h2>
          <div className="space-y-1">
            <Label htmlFor="projName" className="text-2xs font-semibold">
              {copy.projectName}
            </Label>
            <Input
              id="projName"
              value={projectName}
              disabled={createProject.isPending}
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
            <p id="product-description-hint" className="text-xs leading-5 text-muted-foreground">
              {controls.productHint}
            </p>
            <Textarea
              id="projDesc"
              aria-describedby="product-description-hint"
              value={productDesc}
              disabled={createProject.isPending}
              onChange={(e) => setProductDesc(e.target.value)}
              placeholder={copy.productPlaceholder}
              rows={3}
              className="min-h-20 text-base leading-[normal]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-knowledge">{flow.kb}</Label>
            <Select
              id="project-knowledge"
              value={knowledgeBaseId}
              disabled={knowledge.isLoading || createProject.isPending}
              onChange={(e) => setKnowledgeBaseId(e.target.value)}
            >
              <option value="">{knowledge.isLoading ? flow.loadingSources : flow.none}</option>
              {knowledge.data?.data.map((kb) => (
                <option key={kb.id} value={kb.id}>
                  {kb.name}
                </option>
              ))}
            </Select>
            {knowledge.isError && <ErrorState onRetry={() => void knowledge.refetch()} />}
            <Link
              className="text-sm underline"
              href="/dashboard/knowledge"
              target="_blank"
              rel="noopener noreferrer"
            >
              {flow.add}
            </Link>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="ghost"
              type="button"
              disabled={createProject.isPending}
              onClick={() => updateView(projectId, false, true)}
            >
              {copy.cancel}
            </Button>
            <Button size="sm" type="submit" disabled={createProject.isPending}>
              {createProject.isPending ? copy.creating : copy.createNow}
            </Button>
          </div>
        </form>
      )}

      <div className="min-w-0">
        {!projectId && projectList}
        {projectId && !selectedProject && projectDetails.isPending && <LoadingCards count={1} />}
        {projectId && !selectedProject && projectDetails.isError && (
          <ErrorState
            message={errorMessage(projectDetails.error, undefined, locale)}
            onRetry={() => void projectDetails.refetch()}
          />
        )}

        {projectId && selectedProject && projectDeleting && (
          <section className="surface-card space-y-3 p-4">
            <h2 className="break-words text-lg font-semibold">{selectedProject.name}</h2>
            <p role="status" className="text-sm text-muted-foreground">
              {copy.finishDelete}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteProjectId(projectId)}
            >
              {copy.deleteProject}
            </Button>
          </section>
        )}
        {projectId && selectedProject && !projectDeleting && (
          <div className="space-y-3">
            <div className="flex gap-1.5 border-b sm:gap-4" role="group" aria-label={copy.title}>
              <button
                type="button"
                className={`inline-flex min-h-11 items-center gap-1.5 border-b-2 px-1 text-xs sm:text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${isTranslations ? 'border-transparent text-muted-foreground hover:text-foreground' : 'border-primary text-primary'}`}
                aria-pressed={!isTranslations}
                aria-controls="copy-workspace"
                onClick={() => switchPanel(false)}
              >
                <FileText size={15} className="max-[359px]:hidden" aria-hidden="true" />
                {workspace.formats}
              </button>
              <button
                type="button"
                className={`inline-flex min-h-11 items-center gap-1.5 border-b-2 px-1 text-xs sm:text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${isTranslations ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                aria-pressed={isTranslations}
                aria-controls="shopify-workspace"
                onClick={() => switchPanel(true)}
              >
                <FileSpreadsheet size={15} className="max-[359px]:hidden" aria-hidden="true" />
                {workspace.translations}
              </button>
            </div>

            {projectJob && (
              <JobProgress
                key={projectJob.id}
                jobId={projectJob.id}
                showResult={false}
                onSettled={(job) => {
                  if (!projectJob.active) return;
                  queryClient.setQueryData<TrackedJob>(projectJobKey(projectId), (tracked) =>
                    tracked?.id === job.id ? { id: job.id, active: false } : tracked,
                  );
                  void queryClient.invalidateQueries({
                    queryKey: ['content-items', projectId],
                  });
                }}
              />
            )}
            {itemsLoading && (
              <p role="status" className="text-sm text-muted-foreground">
                {controls.loading}
              </p>
            )}
            {itemsError && <ErrorState onRetry={() => void refetchItems()} />}
            <div id="shopify-workspace" hidden={!isTranslations}>
              <ShopifyTranslations
                key={projectId}
                projectId={projectId}
                items={items ?? []}
                jobId={
                  translationJob && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/.test(translationJob)
                    ? translationJob
                    : null
                }
              />
            </div>
            <section id="copy-workspace" aria-label={workspace.formats} hidden={isTranslations}>
              <div className="min-[1200px]:grid min-[1200px]:items-start min-[1200px]:gap-3 min-[1200px]:grid-cols-[11rem_minmax(0,1fr)]">
                <aside
                  aria-label={workspace.formats}
                  className="hidden rounded-xl border bg-card/75 p-2 min-[1200px]:block"
                >
                  <div className="px-2 pb-1.5 pt-1 text-sm font-semibold">{workspace.kind}</div>
                  {formatGroups.map((group, groupIndex) => {
                    const entries = CONTENT_TYPES.filter((entry) => group.includes(entry.key));
                    if (groupIndex === 0)
                      return (
                        <div key={group[0]} className="pb-1">
                          {entries.map(formatButton)}
                        </div>
                      );
                    const available = entries.filter((entry) => results.has(entry.key));
                    const more = entries.filter((entry) => !results.has(entry.key));
                    return (
                      <div key={group[0]} className="mt-1 border-t border-border/70 pt-1">
                        {available.length > 0 && (
                          <>
                            <p className="px-2 py-1 text-xs text-muted-foreground">
                              {workspace.groups[groupIndex]}
                            </p>
                            {available.map(formatButton)}
                          </>
                        )}
                        {more.length > 0 && (
                          <details
                            className="group/formats"
                            open={more.some((entry) => entry.key === format.key) || undefined}
                          >
                            <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-2 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                              <span>
                                {available.length
                                  ? workspace.moreFormats
                                  : workspace.groups[groupIndex]}
                              </span>
                              <ChevronDown
                                size={14}
                                className="shrink-0 group-open/formats:rotate-180"
                                aria-hidden="true"
                              />
                            </summary>
                            {more.map(formatButton)}
                          </details>
                        )}
                      </div>
                    );
                  })}
                </aside>
                <div className="min-w-0 rounded-xl border bg-card">
                  <div className="relative flex min-w-0 items-center justify-between gap-1.5 border-b px-3 py-2 sm:gap-2 sm:px-4">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:gap-2.5">
                      <label className="min-w-[5.25rem] flex-1 sm:max-w-[15rem] min-[1200px]:hidden">
                        <span className="sr-only">{workspace.kind}</span>
                        <Select
                          aria-label={workspace.kind}
                          className="h-10 min-w-0 rounded-md bg-background px-2 text-xs shadow-none sm:text-sm"
                          value={format.key}
                          onChange={(event) => changeFormat(event.target.value)}
                        >
                          {CONTENT_TYPES.map((entry) => (
                            <option key={entry.key} value={entry.key}>
                              {entry.labels[locale]}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <div className="hidden min-w-0 items-center gap-2 min-[1200px]:flex">
                        <format.icon
                          size={17}
                          className="shrink-0 text-primary"
                          aria-hidden="true"
                        />
                        <h3 className="min-w-0 break-words font-display text-lg font-semibold tracking-tight">
                          {format.labels[locale]}
                        </h3>
                      </div>
                      {result && (
                        <>
                          <div className="hidden sm:block">{reviewStatus}</div>
                          {history.length > 1 && (
                            <label className="min-w-0 text-xs text-muted-foreground">
                              <span className="sr-only">{workspace.history}</span>
                              <Select
                                className="h-9 w-auto max-w-full rounded-md border-border px-2 text-xs shadow-none"
                                value={versions[historyKey] ?? ''}
                                onChange={(e) =>
                                  setVersions((v) => ({ ...v, [historyKey]: e.target.value }))
                                }
                              >
                                <option value="">{workspace.latest}</option>
                                {history.slice(1).map((entry, i) => (
                                  <option key={entry.id} value={entry.id}>
                                    #{history.length - i - 1}
                                  </option>
                                ))}
                              </Select>
                            </label>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <details
                        ref={generationSettings}
                        className="static sm:relative"
                        onKeyDown={(event) => {
                          if (event.key === 'Escape' && event.currentTarget.open) {
                            event.stopPropagation();
                            event.currentTarget.open = false;
                            event.currentTarget.querySelector('summary')?.focus();
                          }
                        }}
                      >
                        <summary className="flex size-11 cursor-pointer list-none items-center justify-center gap-1.5 rounded-md text-xs font-semibold sm:w-auto sm:px-2 text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                          <SlidersHorizontal size={17} aria-hidden="true" />
                          <span className="sr-only sm:not-sr-only">{workspace.settings}</span>
                          <ChevronDown size={14} className="hidden sm:block" aria-hidden="true" />
                        </summary>
                        <div className="absolute end-2 top-full z-20 mt-1 w-[min(16.5rem,calc(100%-1rem))] space-y-3 rounded-lg border bg-card p-3 shadow-xl sm:end-0 sm:w-[16.5rem]">
                          <div className="grid gap-2.5">
                            <div className="space-y-1">
                              <Label htmlFor="content-language">{controls.language}</Label>
                              <Select
                                id="content-language"
                                className="rounded-md shadow-none"
                                value={language}
                                onChange={(event) => setLanguage(event.target.value)}
                              >
                                <option value="en">English</option>
                                <option value="zh-CN">简体中文</option>
                                <option value="zh-TW">繁體中文</option>
                                <option value="ja">日本語</option>
                                <option value="de">Deutsch</option>
                                <option value="fr">Français</option>
                                <option value="es">Español</option>
                                <option value="pt">Português</option>
                                <option value="ar">العربية</option>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="content-market">{controls.market}</Label>
                              <Input
                                id="content-market"
                                className="rounded-md shadow-none"
                                value={market}
                                maxLength={160}
                                onChange={(event) => setMarket(event.target.value)}
                                placeholder={controls.marketHint}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="content-tone">{controls.tone}</Label>
                              <Input
                                id="content-tone"
                                className="rounded-md shadow-none"
                                value={tone}
                                maxLength={200}
                                onChange={(event) => setTone(event.target.value)}
                                placeholder={controls.toneHint}
                              />
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            id="generate-content-batch"
                            disabled={generationDisabled}
                            onClick={() => handleGenerate()}
                            className="h-auto min-h-10 w-full whitespace-normal rounded-md shadow-none backdrop-filter-none"
                          >
                            <Sparkles size={15} aria-hidden="true" />
                            {pendingFormat === 'all' ? copy.generating : copy.generateAll}
                          </Button>
                        </div>
                      </details>
                      {!staleResult && generateAction}
                    </div>
                  </div>
                  <div
                    className={
                      detailedReferences
                        ? 'grid min-w-0 min-[1080px]:grid-cols-[minmax(0,1fr)_minmax(12rem,26%)]'
                        : 'min-w-0'
                    }
                  >
                    <div className="min-w-0">
                      {!detailedReferences && (facts || result) && (
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border/70 bg-muted/40 px-3 py-2 text-xs leading-5 sm:px-4">
                          <span className="shrink-0 font-semibold text-muted-foreground">
                            {workspace.brief}
                          </span>
                          <p className="min-w-0 flex-1 whitespace-pre-wrap [overflow-wrap:anywhere]">
                            {facts || workspace.noFacts}
                          </p>
                          <div className="sm:hidden">{reviewStatus}</div>
                        </div>
                      )}
                      {detailedReferences && (
                        <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-muted/40 px-3 text-xs sm:hidden">
                          <a
                            href="#content-references"
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-sm font-medium text-primary focus-visible:outline focus-visible:outline-2"
                          >
                            <ListChecks size={15} aria-hidden="true" />
                            {workspace.reference}
                            {citations.length > 0 && (
                              <span className="tabular-nums">({citations.length})</span>
                            )}
                          </a>
                          {reviewStatus}
                        </div>
                      )}
                      {result && (
                        <ContentReview
                          key={result.id}
                          documentLayout
                          withReferences={detailedReferences}
                          subject={format.key === 'product_title'}
                          stale={
                            staleResult
                              ? { message: factsCopy.stale, recoveryAction: generateAction }
                              : undefined
                          }
                          citations={result.metadata?.citations ?? []}
                          draft={
                            savedDraft?.itemId === result.id ? savedDraft : persistedDraft(result)
                          }
                          projectId={projectId}
                          item={result}
                          onSaved={() =>
                            setDrafts((current) => {
                              const next = new Map(current);
                              next.delete(draftKey);
                              return next;
                            })
                          }
                          onChange={(draft) =>
                            setDrafts((current) => new Map(current).set(draftKey, draft))
                          }
                          filename={`${format.key}-${result.id}.txt`}
                        />
                      )}
                      {!result && !itemsLoading && !itemsError && (
                        <div className="grid min-h-44 place-content-center gap-1 px-4 py-6 text-center sm:min-h-72">
                          <format.icon
                            size={25}
                            className="mx-auto mb-1 text-primary"
                            aria-hidden="true"
                          />
                          <p className="text-base font-semibold">{workspace.noDraft}</p>
                          <p className="max-w-xs text-sm text-muted-foreground">
                            {format.descriptions[locale]}
                          </p>
                        </div>
                      )}
                    </div>
                    {detailedReferences && (
                      <aside
                        id="content-references"
                        aria-label={workspace.reference}
                        className="min-w-0 scroll-mt-20 rounded-ee-xl border-t bg-[#f7f8fb] dark:bg-[#181923] min-[1080px]:rounded-t-none min-[1080px]:border-s min-[1080px]:border-t-0"
                      >
                        <div className="space-y-4 px-3 py-3 min-[1080px]:sticky min-[1080px]:top-20 min-[1080px]:max-h-[calc(100dvh-6rem)] min-[1080px]:overflow-auto">
                          <h3 className="flex items-center gap-2 text-sm font-semibold">
                            <ListChecks size={16} className="text-primary" aria-hidden="true" />
                            {workspace.reference}
                          </h3>
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-muted-foreground">
                              {workspace.brief}
                            </h4>
                            <p className="max-h-36 overflow-auto whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere] min-[1080px]:max-h-none min-[1080px]:overflow-visible">
                              {facts || workspace.noFacts}
                            </p>
                          </div>
                          {citations.length > 0 && (
                            <ul className="space-y-2 border-t pt-3">
                              {citations.map((citation) => (
                                <li key={citation.reference}>
                                  <details className="rounded-md border bg-card px-2.5 py-2">
                                    <summary className="cursor-pointer rounded-sm text-xs font-semibold leading-5 [overflow-wrap:anywhere] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                                      [{citation.reference}] {citation.title}
                                    </summary>
                                    <p className="mt-2 whitespace-pre-wrap text-xs leading-5 [overflow-wrap:anywhere]">
                                      {citation.snippet}
                                    </p>
                                  </details>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </aside>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={Boolean(deleteProjectId)}
        title={copy.deleteProject}
        description={copy.deleteConfirm}
        confirmLabel={copy.deleteProject}
        cancelLabel={copy.cancel}
        busy={deleteProject.isPending}
        onCancel={() => {
          if (!deleteProject.isPending) setDeleteProjectId(null);
        }}
        onConfirm={() => {
          if (deleteProjectId) handleDeleteProject(deleteProjectId);
        }}
      />
    </div>
  );
}
