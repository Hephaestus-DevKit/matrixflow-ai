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

const TEMPLATES = [
  {
    id: 'tpl_copywriter',
    name: '跨境文案专员',
    role: 'copywriter',
    icon: PenTool,
    color: 'text-primary',
    bg: 'bg-primary/5',
    desc: '撰写高转化率的亚马逊详情页、站外引流文案及海外社媒帖文。',
  },
  {
    id: 'tpl_tiktok',
    name: 'TikTok 内容官',
    role: 'content_creator',
    icon: Video,
    color: 'text-success',
    bg: 'bg-success/5',
    desc: '策划海外爆款视频脚本，自动拆解分镜头及撰写带货口播稿。',
  },
  {
    id: 'tpl_support',
    name: '知识库客服',
    role: 'customer_service',
    icon: Headphones,
    color: 'text-info',
    bg: 'bg-info/5',
    desc: '深度整合商品知识库，7x24小时全天候多语言精准解答买家疑问。',
  },
  {
    id: 'tpl_seo',
    name: 'SEO 分析师',
    role: 'seo_writer',
    icon: Search,
    color: 'text-warning',
    bg: 'bg-warning/5',
    desc: '分析高热度长尾关键词，撰写契合 Google 搜索引擎的高权重博文。',
  },
  {
    id: 'tpl_sales',
    name: '销售跟进员',
    role: 'sales',
    icon: DollarSign,
    color: 'text-primary',
    bg: 'bg-primary/5',
    desc: '自动挖掘潜在意向线索，生成高度定制化的开发信与二次跟进话术。',
  },
];

export default function NewAgentPage() {
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
      alert(errorMessage(error));
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
      alert(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 border-b border-border/40 pb-5">
        <button
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">创建 AI 员工</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            选择契合业务场景的员工，即刻部署至您的工作流中
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant={mode === 'template' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('template')}
          className="text-xs"
        >
          从模板库部署
        </Button>
        <Button
          variant={mode === 'custom' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('custom')}
          className="text-xs"
        >
          自定义配置
        </Button>
      </div>

      <div className="space-y-2 max-w-sm">
        <Label htmlFor="agentName" className="text-xs font-semibold">
          员工姓名 (选填，默认为岗位名)
        </Label>
        <Input
          id="agentName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. 首席文案策划 - Alex"
          className="bg-muted/10 border-border/60 text-sm focus-visible:ring-primary/30"
        />
      </div>

      {mode === 'template' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t) => {
            const Icon = t.icon;
            return (
              <div
                key={t.id}
                className="group rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${t.bg} ${t.color} mb-4`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">
                    {t.name}
                  </h3>
                  <p className="text-2xs text-muted-foreground mt-1">角色代码：{t.role}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-2">{t.desc}</p>
                </div>
                <Button
                  className="mt-6 w-full text-xs shadow-glow-sm hover:shadow-glow"
                  size="sm"
                  onClick={() => createFromTemplate(t.id, t.name)}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : '使用此模板部署'}
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
          className="max-w-md space-y-4 border border-border/60 rounded-xl bg-card p-5"
        >
          <h3 className="text-sm font-bold flex items-center gap-1.5 text-primary">
            <Sparkles className="h-4 w-4" /> 自定义 AI 员工参数
          </h3>
          <div className="space-y-1.5">
            <Label className="text-xs">岗位名称</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 站外引流专家"
              className="bg-muted/10 border-border/60 text-sm focus-visible:ring-primary/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">角色标识 (Role Identifier)</Label>
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. outreach_specialist"
              className="bg-muted/10 border-border/60 text-sm focus-visible:ring-primary/30"
            />
          </div>
          <Button type="submit" disabled={loading || !name.trim()} className="w-full text-xs">
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              '创建自定义 AI 员工'
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
