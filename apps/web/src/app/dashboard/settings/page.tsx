'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  LogOut,
  Check,
  Save,
  Sparkles,
  ShieldCheck,
  Users,
  Plus,
  Mail,
  CircleCheck,
  CircleAlert,
  Network,
} from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { errorMessage } from '@/lib/errors';
import { apiClient } from '@/lib/api-client';

const PRESET_AVATARS = [
  { id: 'slate', color: '#607987', label: '柔蓝' },
  { id: 'rose', color: '#ba7678', label: '落粉' },
  { id: 'sage', color: '#7b8672', label: '黛绿' },
  { id: 'camel', color: '#bd9b70', label: '驼黄' },
  { id: 'terracotta', color: '#a36d65', label: '赭红' },
  { id: 'clay', color: '#888481', label: '烟灰' },
];

function makeSvgAvatar(color: string): string {
  // Return an SVG data URI
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${encodeURIComponent(color)}"/><circle cx="50" cy="38" r="18" fill="white" opacity="0.9"/><path d="M18 80c0-12 12-20 32-20s32 8 32 20" fill="white" opacity="0.9"/></svg>`;
  return `data:image/svg+xml;utf8,${svg}`;
}

export default function SettingsPage() {
  const { user, organizationId, setOrg, updateProfile, logout, createTeam, inviteMember } =
    useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'enterprise'>('profile');
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [customAvatar, setCustomAvatar] = useState('');
  const [saving, setSaving] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [teamPending, setTeamPending] = useState(false);
  const [aiStatus, setAiStatus] = useState<{
    ready: boolean;
    provider?: string;
    protocol?: string;
    model?: string;
  } | null>(null);
  const [aiStatusLoading, setAiStatusLoading] = useState(true);
  const [aiStatusError, setAiStatusError] = useState(false);
  const membership = user?.memberships.find((item) => item.organizationId === organizationId);
  const canInvite = membership?.role === 'owner' || membership?.role === 'admin';

  useEffect(() => {
    if (user) {
      setName(user.name);
      setAvatarUrl(user.avatarUrl ?? '');
      // If the avatarUrl is not one of our presets, populate customAvatar
      const isPreset = PRESET_AVATARS.some((p) => makeSvgAvatar(p.color) === user.avatarUrl);
      if (!isPreset && user.avatarUrl) {
        setCustomAvatar(user.avatarUrl);
      } else {
        setCustomAvatar('');
      }
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    setAiStatusLoading(true);
    setAiStatusError(false);
    void apiClient
      .get<{ ai: { ready: boolean; provider?: string; protocol?: string; model?: string } }>(
        '/health',
      )
      .then((health) => {
        if (!active) return;
        setAiStatus(health.ai);
        setAiStatusLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setAiStatus(null);
        setAiStatusError(true);
        setAiStatusLoading(false);
      });
    return () => {
      active = false;
    };
  }, [organizationId]);

  const selectPreset = (color: string) => {
    const presetUrl = makeSvgAvatar(color);
    setAvatarUrl(presetUrl);
    setCustomAvatar('');
  };

  const handleCustomAvatarChange = (val: string) => {
    setCustomAvatar(val);
    setAvatarUrl(val);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('名称不能为空');
      return;
    }
    setSaving(true);
    try {
      await updateProfile(name, avatarUrl);
      toast.success('个人身份及头像保存成功！');
    } catch (err: unknown) {
      toast.error(errorMessage(err, '保存失败，请稍后重试'));
    } finally {
      setSaving(false);
    }
  };

  async function handleCreateTeam(event: React.FormEvent) {
    event.preventDefault();
    setTeamPending(true);
    try {
      await createTeam(teamName);
      setTeamName('');
      toast.success('团队已创建并切换');
    } catch (error) {
      toast.error(errorMessage(error, '团队创建失败'));
    } finally {
      setTeamPending(false);
    }
  }

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    setTeamPending(true);
    try {
      await inviteMember(inviteEmail, inviteRole);
      setInviteEmail('');
      toast.success('团队邀请已发送');
    } catch (error) {
      toast.error(errorMessage(error, '团队邀请发送失败'));
    } finally {
      setTeamPending(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="border-b border-border/40 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          设置中心
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          管理您的个人身份属性、企业配置以及系统级集成
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/60 gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-2.5 border-b-2 px-1 transition-all ${
            activeTab === 'profile'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          个人资料与头像
        </button>
        <button
          onClick={() => setActiveTab('enterprise')}
          className={`pb-2.5 border-b-2 px-1 transition-all ${
            activeTab === 'enterprise'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          企业设置与安全
        </button>
      </div>

      {activeTab === 'profile' ? (
        /* Profile Tab */
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-5 pb-2 border-b border-border/40">
              {/* Avatar Preview */}
              <div className="relative">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="Preview"
                    width={64}
                    height={64}
                    unoptimized
                    className="h-16 w-16 rounded-full object-cover border border-border bg-muted/40 shadow-sm"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-lg uppercase">
                    {name?.[0] ?? '?'}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground p-1 rounded-full shadow-sm">
                  <Sparkles className="h-3 w-3" />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-foreground">头像与工作身份预览</h3>
                <p className="text-2xs text-muted-foreground mt-0.5">
                  即时同步在左下角及工作台的系统级状态中
                </p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="profileName" className="text-xs font-semibold text-foreground">
                  工作姓名
                </Label>
                <Input
                  id="profileName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如: Jiehu Wang"
                  required
                  className="bg-muted/20 border-border/60 focus-visible:ring-primary/30"
                />
              </div>

              {/* Presets Grid */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">选择莫兰迪风格头像</Label>
                <div className="grid grid-cols-6 gap-3">
                  {PRESET_AVATARS.map((p) => {
                    const presetUri = makeSvgAvatar(p.color);
                    const isSelected = avatarUrl === presetUri;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectPreset(p.color)}
                        className={`group relative flex aspect-square flex-col items-center justify-center rounded-xl border text-center transition-all duration-200 ${
                          isSelected
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-border hover:border-foreground/40 bg-muted/10'
                        }`}
                        title={p.label}
                      >
                        <div
                          className="h-7 w-7 rounded-full shadow-sm border border-black/5"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="text-[10px] text-muted-foreground mt-1.5 group-hover:text-foreground font-medium">
                          {p.label}
                        </span>
                        {isSelected && (
                          <div className="absolute top-1 right-1 bg-primary text-primary-foreground p-0.5 rounded-full">
                            <Check className="h-2 w-2" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Input */}
              <div className="space-y-1.5">
                <Label htmlFor="customAvatar" className="text-xs font-semibold text-foreground">
                  或者使用 Appwrite 托管头像链接
                </Label>
                <Input
                  id="customAvatar"
                  value={customAvatar}
                  onChange={(e) => handleCustomAvatarChange(e.target.value)}
                  placeholder="https://sgp.cloud.appwrite.io/..."
                  className="bg-muted/20 border-border/60 focus-visible:ring-primary/30 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={saving}
              className="gap-1.5 text-xs font-bold px-5 shadow-glow-sm hover:shadow-glow"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? '正在保存...' : '保存更改'}
            </Button>
          </div>
        </form>
      ) : (
        /* Enterprise Tab */
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-border/40">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/5 text-primary border border-primary/10">
                <ShieldCheck className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-foreground">组织角色权限</h3>
                <p className="text-2xs text-muted-foreground mt-0.5">
                  当前登录企业级节点及资源范围说明
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-muted/10 p-3 rounded-lg border border-border/40">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase">
                  所属企业组织
                </p>
                <p className="font-bold text-foreground mt-1">
                  {membership?.organizationName ?? '未选择组织'}
                </p>
              </div>
              <div className="bg-muted/10 p-3 rounded-lg border border-border/40">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase">
                  组织角色定位
                </p>
                <p className="font-bold text-primary mt-1 flex items-center gap-1">
                  {membership?.role ?? '未分配'}
                </p>
              </div>
            </div>
            {user && user.memberships.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="organization" className="text-xs font-semibold text-foreground">
                  当前工作组织
                </Label>
                <select
                  id="organization"
                  value={organizationId ?? ''}
                  onChange={(event) => setOrg(event.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {user.memberships.map((item) => (
                    <option key={item.organizationId} value={item.organizationId}>
                      {item.organizationName} · {item.role}
                    </option>
                  ))}
                </select>
                <p className="text-[0.6875rem] text-muted-foreground">
                  切换后，后续 API 请求会自动限定到所选组织。
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <form
              onSubmit={handleCreateTeam}
              className="rounded-xl border border-border/60 bg-card p-5 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold">创建新团队</h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                创建独立的数据与权限空间，完成后自动切换。
              </p>
              <Label htmlFor="new-team-name" className="mt-4 block text-xs">
                团队名称
              </Label>
              <Input
                id="new-team-name"
                className="mt-2"
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                placeholder="例如：北美运营团队"
              />
              <Button
                type="submit"
                variant="outline"
                className="mt-3 w-full"
                disabled={!teamName.trim() || teamPending}
              >
                {teamPending ? '处理中…' : '创建团队'}
              </Button>
            </form>

            <form
              onSubmit={handleInvite}
              className="rounded-xl border border-border/60 bg-card p-5 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold">邀请团队成员</h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {canInvite
                  ? 'Appwrite 将发送带有安全验证链接的邀请邮件。'
                  : '只有团队所有者或管理员可以邀请成员。'}
              </p>
              <Label htmlFor="invite-email" className="mt-4 block text-xs">
                成员邮箱
              </Label>
              <Input
                id="invite-email"
                type="email"
                className="mt-2"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="member@example.com"
                disabled={!canInvite}
              />
              <div className="mt-2 flex gap-2">
                <select
                  aria-label="成员角色"
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as 'member' | 'admin')}
                  disabled={!canInvite}
                  className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="member">成员</option>
                  <option value="admin">管理员</option>
                </select>
                <Button type="submit" disabled={!canInvite || !inviteEmail.trim() || teamPending}>
                  <Mail className="h-4 w-4" /> 邀请
                </Button>
              </div>
            </form>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/5 text-primary">
                  <Network className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">AI 协议连接</p>
                  <p className="text-2xs text-muted-foreground mt-0.5">
                    由 Appwrite Function 安全托管模型密钥，浏览器不会接触任何凭证
                  </p>
                </div>
              </div>
              {aiStatusLoading ? (
                <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                  检测中
                </span>
              ) : aiStatus?.ready ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-bold text-success">
                  <CircleCheck className="h-3 w-3" /> 已连接
                </span>
              ) : aiStatusError ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                  <CircleAlert className="h-3 w-3" /> 状态不可用
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1 text-[10px] font-bold text-warning">
                  <CircleAlert className="h-3 w-3" /> 待配置
                </span>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ['Anthropic', 'Messages API'],
                ['OpenAI', 'Chat Completions'],
                ['兼容网关', 'GLM / vLLM / LiteLLM'],
              ].map(([name, protocol]) => (
                <div
                  key={name}
                  className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2.5"
                >
                  <p className="text-[11px] font-semibold text-foreground">{name}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{protocol}</p>
                </div>
              ))}
            </div>
            {aiStatusLoading ? (
              <p className="text-[11px] leading-5 text-muted-foreground">
                正在检查 Appwrite Function 的 AI 连接状态…
              </p>
            ) : aiStatus?.ready ? (
              <p className="text-[11px] leading-5 text-muted-foreground">
                当前使用 <span className="font-semibold text-foreground">{aiStatus.provider}</span>
                {aiStatus.protocol ? ` · ${aiStatus.protocol}` : ''}
                {aiStatus.model ? ` · ${aiStatus.model}` : ''}。如需切换，请在 Appwrite Console 的
                <span className="font-semibold text-foreground"> matrixflow-core</span>{' '}
                函数变量中修改协议和密钥。
              </p>
            ) : (
              <p className="text-[11px] leading-5 text-muted-foreground">
                {aiStatusError ? '暂时无法读取连接状态，请稍后刷新重试。' : '管理员配置 '}
                {!aiStatusError && (
                  <>
                    <span className="font-semibold text-foreground">ANTHROPIC_API_KEY</span>、
                    <span className="font-semibold text-foreground">OPENAI_API_KEY</span> 或
                    <span className="font-semibold text-foreground">GLM_API_KEY</span>{' '}
                    后，重新部署函数即可启用。
                  </>
                )}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="pt-2 flex justify-start">
            <Button
              variant="destructive"
              onClick={logout}
              className="w-full sm:w-auto text-xs font-semibold gap-1.5 px-5"
            >
              <LogOut className="h-3.5 w-3.5" /> 退出当前登录
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
