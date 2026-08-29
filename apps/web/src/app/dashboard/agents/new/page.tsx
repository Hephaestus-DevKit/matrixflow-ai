'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  PenTool,
  Video,
  Headphones,
  Search,
  DollarSign,
  ArrowLeft,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { errorMessage } from '@/lib/errors';
import { useLocale, type Locale } from '@/lib/i18n';
import { toast } from 'sonner';

const TEMPLATES = [
  {
    id: 'tpl_copywriter',
    names: { 'zh-CN': '跨境文案专员', 'zh-TW': '跨境文案專員', en: 'Cross-border copywriter' },
    role: 'copywriter',
    icon: PenTool,
    color: 'text-primary',
    bg: 'bg-primary/5',
    descs: {
      'zh-CN': '撰写高转化率的亚马逊详情页、站外引流文案及海外社媒帖文。',
      'zh-TW': '撰寫高轉換率的亞馬遜詳情頁、站外引流文案與海外社群貼文。',
      en: 'Write high-converting Amazon listings, acquisition copy, and social posts.',
    },
  },
  {
    id: 'tpl_tiktok',
    names: { 'zh-CN': 'TikTok 内容官', 'zh-TW': 'TikTok 內容官', en: 'TikTok content lead' },
    role: 'content_creator',
    icon: Video,
    color: 'text-success',
    bg: 'bg-success/5',
    descs: {
      'zh-CN': '策划海外爆款视频脚本，自动拆解分镜头及撰写带货口播稿。',
      'zh-TW': '策劃海外熱門影片腳本，自動拆解分鏡並撰寫帶貨口播稿。',
      en: 'Plan viral short-video scripts with shot lists and spoken selling points.',
    },
  },
  {
    id: 'tpl_support',
    names: { 'zh-CN': '知识库客服', 'zh-TW': '知識庫客服', en: 'Knowledge-base support' },
    role: 'customer_service',
    icon: Headphones,
    color: 'text-info',
    bg: 'bg-info/5',
    descs: {
      'zh-CN': '基于团队知识库生成多语言客服回复建议，并保留可复核的运行记录。',
      'zh-TW': '根據團隊知識庫生成多語客服回覆建議，並保留可複核的執行記錄。',
      en: 'Draft multilingual support replies from team knowledge with reviewable run records.',
    },
  },
  {
    id: 'tpl_seo',
    names: { 'zh-CN': 'SEO 分析师', 'zh-TW': 'SEO 分析師', en: 'SEO analyst' },
    role: 'seo_writer',
    icon: Search,
    color: 'text-warning',
    bg: 'bg-warning/5',
    descs: {
      'zh-CN': '根据输入的关键词与商品资料生成可复核的 SEO 内容草稿。',
      'zh-TW': '根據輸入的關鍵字與商品資料生成可複核的 SEO 內容草稿。',
      en: 'Create reviewable SEO drafts from keywords and product context.',
    },
  },
  {
    id: 'tpl_sales',
    names: { 'zh-CN': '销售跟进员', 'zh-TW': '銷售跟進員', en: 'Sales follow-up' },
    role: 'sales',
    icon: DollarSign,
    color: 'text-primary',
    bg: 'bg-primary/5',
    descs: {
      'zh-CN': '根据客户资料生成个性化开发信与跟进话术，不会自动发送外部消息。',
      'zh-TW': '根據客戶資料生成個人化開發信與跟進話術，不會自動發送外部訊息。',
      en: 'Create personalized outreach and follow-up copy without sending external messages.',
    },
  },
];

const COPY: Record<
  Locale,
  {
    title: string;
    description: string;
    template: string;
    custom: string;
    name: string;
    namePlaceholder: string;
    roleCode: string;
    deploy: string;
    customTitle: string;
    roleName: string;
    roleNamePlaceholder: string;
    roleId: string;
    createCustom: string;
    back: string;
  }
> = {
  'zh-CN': {
    title: '创建 AI 员工',
    description: '选择契合业务场景的员工，即刻部署至您的工作流中',
    template: '从模板库部署',
    custom: '自定义配置',
    name: '员工姓名（选填，默认为岗位名）',
    namePlaceholder: '例如：首席文案策划 - Alex',
    roleCode: '角色代码',
    deploy: '使用此模板部署',
    customTitle: '自定义 AI 员工参数',
    roleName: '岗位名称',
    roleNamePlaceholder: '例如：站外引流专家',
    roleId: '角色标识',
    createCustom: '创建自定义 AI 员工',
    back: '返回',
  },
  'zh-TW': {
    title: '建立 AI 員工',
    description: '選擇符合業務場景的員工，即刻部署至您的工作流中',
    template: '從模板庫部署',
    custom: '自訂設定',
    name: '員工姓名（選填，預設為職位名稱）',
    namePlaceholder: '例如：首席文案企劃 - Alex',
    roleCode: '角色代碼',
    deploy: '使用此模板部署',
    customTitle: '自訂 AI 員工參數',
    roleName: '職位名稱',
    roleNamePlaceholder: '例如：站外引流專家',
    roleId: '角色識別',
    createCustom: '建立自訂 AI 員工',
    back: '返回',
  },
  en: {
    title: 'Create an AI worker',
    description: 'Choose a role that fits your use case and deploy it into your workflow.',
    template: 'Deploy from templates',
    custom: 'Custom setup',
    name: 'Worker name (optional; defaults to role)',
    namePlaceholder: 'e.g. Lead copy strategist - Alex',
    roleCode: 'Role code',
    deploy: 'Deploy this template',
    customTitle: 'Custom AI worker parameters',
    roleName: 'Role name',
    roleNamePlaceholder: 'e.g. Outreach specialist',
    roleId: 'Role identifier',
    createCustom: 'Create custom AI worker',
    back: 'Back',
  },
};

export default function NewAgentPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const [mode, setMode] = useState<'template' | 'custom'>('template');
  const [name, setName] = useState('');
  const [role, setRole] = useState('copywriter');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function createFromTemplate(templateId: string, defaultName: string) {
    const finalName = name.trim() || defaultName;
    setLoading(true);
    try {
      await apiClient.post(`/agents/from-template/${templateId}`, { name: finalName });
      router.push('/dashboard/agents');
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function createCustom() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await apiClient.post('/agents', {
        name,
        role,
        systemPrompt: { raw: 'You are a helpful AI assistant.' },
        skills: [],
        tools: [],
      });
      router.push('/dashboard/agents');
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 border-b border-border/40 pb-5">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => router.back()}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={copy.back}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{copy.title}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{copy.description}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant={mode === 'template' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('template')}
          className="text-xs"
        >
          {copy.template}
        </Button>
        <Button
          variant={mode === 'custom' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('custom')}
          className="text-xs"
        >
          {copy.custom}
        </Button>
      </div>

      <div className="space-y-2 max-w-sm">
        <Label htmlFor="agentName" className="text-xs font-semibold">
          {copy.name}
        </Label>
        <Input
          id="agentName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={copy.namePlaceholder}
          className="bg-muted/10 border-border/60 text-sm focus-visible:ring-primary/30"
        />
      </div>

      {mode === 'template' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.id} className="interactive-card group flex flex-col justify-between p-5">
                <div>
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${t.bg} ${t.color} mb-4`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">
                    {t.names[locale]}
                  </h3>
                  <p className="text-2xs text-muted-foreground mt-1">
                    {copy.roleCode}: {t.role}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                    {t.descs[locale]}
                  </p>
                </div>
                <Button
                  className="mt-6 w-full text-xs"
                  size="sm"
                  onClick={() => createFromTemplate(t.id, t.names[locale])}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : copy.deploy}
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) createCustom();
          }}
          className="surface-card max-w-md space-y-4 p-5"
        >
          <h3 className="text-sm font-bold flex items-center gap-1.5 text-primary">
            <Sparkles className="h-4 w-4" /> {copy.customTitle}
          </h3>
          <div className="space-y-1.5">
            <Label htmlFor="custom-agent-name" className="text-xs">
              {copy.roleName}
            </Label>
            <Input
              id="custom-agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={copy.roleNamePlaceholder}
              className="bg-muted/10 border-border/60 text-sm focus-visible:ring-primary/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-agent-role" className="text-xs">
              {copy.roleId}
            </Label>
            <Input
              id="custom-agent-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. outreach_specialist"
              className="bg-muted/10 border-border/60 text-sm focus-visible:ring-primary/30"
            />
          </div>
          <Button type="submit" disabled={loading || !name.trim()} className="w-full text-xs">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : copy.createCustom}
          </Button>
        </form>
      )}
    </div>
  );
}
