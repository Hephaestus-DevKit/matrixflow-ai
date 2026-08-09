'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Key, LogOut, Check, Save, Sparkles, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { errorMessage } from '@/lib/errors';

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
  const { user, organizationId, setOrg, updateProfile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'enterprise'>('profile');
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [customAvatar, setCustomAvatar] = useState('');
  const [saving, setSaving] = useState(false);
  const membership = user?.memberships.find((item) => item.organizationId === organizationId);

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
                  或者使用自定义头像链接 (URL)
                </Label>
                <Input
                  id="customAvatar"
                  value={customAvatar}
                  onChange={(e) => handleCustomAvatarChange(e.target.value)}
                  placeholder="输入 https:// 格式的头像图片直链"
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

          {/* API Key */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/5 text-primary">
                <Key className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">API 接入密钥</p>
                <p className="text-2xs text-muted-foreground mt-0.5">
                  支持对接店小秘、马帮等外部 ERP 平台进行商品同步
                </p>
              </div>
            </div>
            <span className="rounded-full bg-primary/5 px-2.5 py-0.5 text-primary text-[10px] font-bold border border-primary/10">
              即将上线
            </span>
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
