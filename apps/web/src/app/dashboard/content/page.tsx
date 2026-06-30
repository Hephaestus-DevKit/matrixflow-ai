'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Factory, Sparkles, Plus, Loader2, AlertCircle } from 'lucide-react';

const CONTENT_TYPES = [
  { key: 'product_title', label: '商品标题', icon: '🏷️', desc: '根据商品卖点自动生成吸引点击的电商标题' },
  { key: 'listing', label: '商品详情页', icon: '📄', desc: '标准的 Amazon/eBay 详情描述与五点描述' },
  { key: 'faq', label: 'FAQ 问答', icon: '❓', desc: '针对商品的常见疑难问题进行专业解答' },
  { key: 'tiktok_script', label: 'TikTok 脚本', icon: '🎬', desc: '适合短视频传播的带货口播与分镜头脚本' },
  { key: 'instagram', label: 'Instagram 文案', icon: '📸', desc: '配有热门标签与互动话题的社媒种草文案' },
  { key: 'facebook_ad', label: 'Facebook 广告', icon: '📢', desc: '高点击率的广告正文与吸睛标题组合' },
  { key: 'email_marketing', label: '邮件营销 (EDM)', icon: '📧', desc: '针对新客转化或老客复购的营销推介信' },
  { key: 'seo_blog', label: 'SEO 博客文章', icon: '📝', desc: '以行业关键词为核心的深度软文与导购指南' },
  { key: 'customer_service', label: '客服话术', icon: '💬', desc: '包含售前引导、售后纠纷处理的快捷回复语' },
  { key: 'landing_page', label: '营销落地页', icon: '🚀', desc: '符合消费心理学的单品落地页排版与文案' },
  { key: 'multilingual', label: '多语言翻译', icon: '🌍', desc: '针对本土文化优化的多语种地道翻译' },
  { key: 'brand_voice', label: '品牌语气改写', icon: '🎨', desc: '按照特定调性（幽默、科技、奢华）重新包装' },
];

export default function ContentFactoryPage() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [productDesc, setProductDesc] = useState('');

  const { data: projects, refetch: refetchProjects } = useQuery({ 
    queryKey: ['content-projects'], 
    queryFn: () => apiClient.get<any[]>('/content/projects') 
  });
  
  const { data: items, refetch: refetchItems } = useQuery({ 
    queryKey: ['content-items', projectId], 
    queryFn: () => apiClient.get<any[]>(`/content/projects/${projectId}/items`), 
    enabled: !!projectId 
  });

  useEffect(() => {
    if (Array.isArray(items)) {
      const mappedResults: Record<string, any> = {};
      items.forEach((item: any) => {
        mappedResults[item.type] = {
          itemId: item.id,
          content: item.body?.parsed ?? item.body?.raw ?? '',
          usage: item.metadata?.usage,
          cost: item.metadata?.cost
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
      await apiClient.post<any>(`/content/projects/${projectId}/generate`, { type, variables: { language: 'en' } });
      await refetchItems();
    } catch (e: any) { 
      alert(e.message); 
    } finally { 
      setGenerating(null); 
    }
  }

  async function generateAll() {
    if (!projectId) return;
    setGenerating('all');
    try { 
      await apiClient.post<any>(`/content/projects/${projectId}/generate-all`, { language: 'en' }); 
      await refetchItems();
    } catch (e: any) { 
      alert(e.message); 
    } finally { 
      setGenerating(null); 
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!projectName.trim()) return;
    setGenerating('create');
    try {
      const res = await apiClient.post<any>('/content/projects', {
        name: projectName,
        productData: { title: projectName, description: productDesc }
      });
      await refetchProjects();
      setProjectId(res.id);
      setProjectName('');
      setProductDesc('');
      setIsCreating(false);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-border/40 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">内容工厂</h1>
          <p className="text-xs text-muted-foreground mt-1">智能批量产出适用于不同平台的电商宣发和社媒运营文案</p>
        </div>
        <Button onClick={() => setIsCreating(!isCreating)} className="gap-1.5 text-xs font-semibold">
          <Plus className="h-3.5 w-3.5" /> 新建内容项目
        </Button>
      </div>

      {/* Create project inline-form */}
      {isCreating && (
        <form onSubmit={handleCreateProject} className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4 max-w-xl animate-slide-up">
          <h3 className="text-sm font-bold flex items-center gap-1.5 text-primary">
            <Sparkles className="h-4 w-4" /> 快速新建项目
          </h3>
          <div className="space-y-1">
            <Label htmlFor="projName" className="text-2xs font-semibold">项目名称</Label>
            <Input 
              id="projName" 
              value={projectName} 
              onChange={(e) => setProjectName(e.target.value)} 
              placeholder="e.g. 智能便携吸尘器推广" 
              required
              className="bg-background border-border/80 text-sm focus-visible:ring-primary/30"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="projDesc" className="text-2xs font-semibold">产品核心卖点/描述</Label>
            <textarea 
              id="projDesc" 
              value={productDesc} 
              onChange={(e) => setProductDesc(e.target.value)} 
              placeholder="e.g. 200W大吸力，无线超轻量化，续航45分钟，配备多功能刷头，专为宠物家庭设计..." 
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-border/85 focus-visible:ring-primary/30"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" type="button" onClick={() => setIsCreating(false)}>取消</Button>
            <Button size="sm" type="submit" disabled={generating === 'create'}>
              {generating === 'create' ? '正在创建...' : '立即创建'}
            </Button>
          </div>
        </form>
      )}

      {/* Project selector */}
      <div className="space-y-2">
        <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block">选择项目进行编辑</span>
        <div className="flex flex-wrap gap-2">
          {projects?.map((p: any) => (
            <button 
              key={p.id} 
              onClick={() => setProjectId(p.id)} 
              className={`rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-all ${
                projectId === p.id 
                  ? 'border-primary bg-primary/10 text-primary shadow-sm' 
                  : 'border-border/60 text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {p.name}
            </button>
          ))}
          {(!projects || projects.length === 0) && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> 暂无可用项目，请点击右上角新建项目。
            </span>
          )}
        </div>
      </div>

      {!projectId && (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-12 text-center flex flex-col items-center justify-center">
          <Factory className="h-10 w-10 text-muted-foreground/60 mb-3 animate-pulse-slow" />
          <p className="text-sm font-semibold text-foreground">暂未选择项目</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-[280px]">选择上方已有项目或新建一个项目以启动 AI 员工的批量内容处理工厂。</p>
        </div>
      )}

      {projectId && (
        <div className="space-y-6 animate-slide-up">
          <div className="flex items-center gap-3 border-t border-border/40 pt-6">
            <Button onClick={generateAll} disabled={!!generating} className="gap-2 text-xs shadow-glow-sm hover:shadow-glow">
              {generating === 'all' ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  智能矩阵流生成中，请耐心等候...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  一键生成全部 12 类跨境文案矩阵
                </>
              )}
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CONTENT_TYPES.map((ct) => (
              <div key={ct.key} className="flex flex-col justify-between rounded-xl border border-border/60 bg-card p-5 transition-all hover:border-border hover:shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{ct.icon}</span>
                      <span className="text-sm font-bold text-foreground">{ct.label}</span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => generate(ct.key)} 
                      disabled={!!generating}
                      className="h-7 text-2xs px-2.5 border-border/60 hover:bg-muted"
                    >
                      {generating === ct.key ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        '重新生成'
                      )}
                    </Button>
                  </div>
                  <p className="text-2xs text-muted-foreground leading-relaxed mb-4">{ct.desc}</p>
                </div>
                
                {results[ct.key] && (
                  <div className="mt-2 space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">AI 输出：</span>
                    <pre className="max-h-40 overflow-auto rounded-lg bg-muted/40 p-3 text-[11px] font-mono leading-relaxed border border-border/40 whitespace-pre-wrap">
                      {typeof results[ct.key].content === 'string'
                        ? results[ct.key].content
                        : JSON.stringify(results[ct.key].content, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}