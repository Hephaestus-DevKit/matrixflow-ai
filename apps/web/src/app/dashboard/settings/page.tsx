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
import { account } from '@/lib/appwrite';
import { useLocale, type Locale } from '@/lib/i18n';

const COPY: Record<
  Locale,
  {
    title: string;
    description: string;
    tabs: { profile: string; enterprise: string };
    preview: string;
    previewDescription: string;
    workName: string;
    workNamePlaceholder: string;
    avatarStyle: string;
    avatarHosted: string;
    saving: string;
    save: string;
    nameRequired: string;
    profileSaved: string;
    saveFailed: string;
    orgPermissions: string;
    orgDescription: string;
    orgName: string;
    noOrg: string;
    role: string;
    unassigned: string;
    currentOrg: string;
    orgHint: string;
    createTeam: string;
    createTeamDescription: string;
    teamName: string;
    teamNamePlaceholder: string;
    creating: string;
    create: string;
    inviteTeam: string;
    inviteAllowed: string;
    inviteDenied: string;
    memberEmail: string;
    memberRole: string;
    member: string;
    admin: string;
    invite: string;
    inviteSent: string;
    inviteFailed: string;
    protocolTitle: string;
    protocolDescription: string;
    checking: string;
    connected: string;
    unavailable: string;
    pending: string;
    checkingDescription: string;
    readyPrefix: string;
    changeHint: string;
    unavailableDescription: string;
    configurePrefix: string;
    configureSuffix: string;
    logout: string;
    sessionsTitle: string;
    sessionsDescription: string;
    sessionsLoading: string;
    sessionsEmpty: string;
    currentSession: string;
    revokeSession: string;
    revokeOthers: string;
    sessionsRevoked: string;
    sessionsFailed: string;
  }
> = {
  'zh-CN': {
    title: '设置中心',
    description: '管理您的个人身份属性、企业配置以及系统级集成',
    tabs: { profile: '个人资料与头像', enterprise: '企业设置与安全' },
    preview: '头像与工作身份预览',
    previewDescription: '即时同步在左下角及工作台的系统级状态中',
    workName: '工作姓名',
    workNamePlaceholder: '例如：运营负责人',
    avatarStyle: '选择莫兰迪风格头像',
    avatarHosted: '或者使用 Appwrite 托管头像链接',
    saving: '正在保存…',
    save: '保存更改',
    nameRequired: '名称不能为空',
    profileSaved: '个人身份及头像保存成功！',
    saveFailed: '保存失败，请稍后重试',
    orgPermissions: '组织角色权限',
    orgDescription: '当前登录企业级节点及资源范围说明',
    orgName: '所属企业组织',
    noOrg: '未选择组织',
    role: '组织角色定位',
    unassigned: '未分配',
    currentOrg: '当前工作组织',
    orgHint: '切换后，后续 API 请求会自动限定到所选组织。',
    createTeam: '创建新团队',
    createTeamDescription: '创建独立的数据与权限空间，完成后自动切换。',
    teamName: '团队名称',
    teamNamePlaceholder: '例如：北美运营团队',
    creating: '处理中…',
    create: '创建团队',
    inviteTeam: '邀请团队成员',
    inviteAllowed: 'Appwrite 将发送带有安全验证链接的邀请邮件。',
    inviteDenied: '只有团队所有者或管理员可以邀请成员。',
    memberEmail: '成员邮箱',
    memberRole: '成员角色',
    member: '成员',
    admin: '管理员',
    invite: '邀请',
    inviteSent: '团队邀请已发送',
    inviteFailed: '团队邀请发送失败',
    protocolTitle: 'AI 协议连接',
    protocolDescription: '由 Appwrite Function 安全托管模型密钥，浏览器不会接触任何凭证',
    checking: '检测中',
    connected: '已连接',
    unavailable: '状态不可用',
    pending: '待配置',
    checkingDescription: '正在检查 Appwrite Function 的 AI 连接状态…',
    readyPrefix: '当前使用',
    changeHint: '。如需切换，请在 Appwrite Console 的 matrixflow-core 函数变量中修改协议和密钥。',
    unavailableDescription: '暂时无法读取连接状态，请稍后刷新重试。',
    configurePrefix: '管理员配置 ',
    configureSuffix: ' 后，重新部署函数即可启用。',
    logout: '退出当前登录',
    sessionsTitle: '登录设备管理',
    sessionsDescription: '查看并撤销当前账号的其他登录会话。',
    sessionsLoading: '正在加载登录会话…',
    sessionsEmpty: '暂无其他登录会话',
    currentSession: '当前设备',
    revokeSession: '撤销',
    revokeOthers: '撤销其他设备',
    sessionsRevoked: '其他登录会话已撤销',
    sessionsFailed: '无法管理登录会话，请稍后重试',
  },
  'zh-TW': {
    title: '設定中心',
    description: '管理您的個人身分屬性、企業設定與系統級整合',
    tabs: { profile: '個人資料與頭像', enterprise: '企業設定與安全' },
    preview: '頭像與工作身分預覽',
    previewDescription: '即時同步在左下角及工作台的系統狀態中',
    workName: '工作姓名',
    workNamePlaceholder: '例如：營運負責人',
    avatarStyle: '選擇莫蘭迪風格頭像',
    avatarHosted: '或使用 Appwrite 託管頭像連結',
    saving: '正在儲存…',
    save: '儲存變更',
    nameRequired: '名稱不能為空',
    profileSaved: '個人身分與頭像儲存成功！',
    saveFailed: '儲存失敗，請稍後重試',
    orgPermissions: '組織角色權限',
    orgDescription: '目前登入企業節點及資源範圍說明',
    orgName: '所屬企業組織',
    noOrg: '未選擇組織',
    role: '組織角色定位',
    unassigned: '未分配',
    currentOrg: '目前工作組織',
    orgHint: '切換後，後續 API 請求會自動限定到所選組織。',
    createTeam: '建立新團隊',
    createTeamDescription: '建立獨立的資料與權限空間，完成後自動切換。',
    teamName: '團隊名稱',
    teamNamePlaceholder: '例如：北美營運團隊',
    creating: '處理中…',
    create: '建立團隊',
    inviteTeam: '邀請團隊成員',
    inviteAllowed: 'Appwrite 將發送帶有安全驗證連結的邀請郵件。',
    inviteDenied: '只有團隊擁有者或管理員可以邀請成員。',
    memberEmail: '成員電子郵件',
    memberRole: '成員角色',
    member: '成員',
    admin: '管理員',
    invite: '邀請',
    inviteSent: '團隊邀請已發送',
    inviteFailed: '團隊邀請發送失敗',
    protocolTitle: 'AI 協議連線',
    protocolDescription: '由 Appwrite Function 安全託管模型金鑰，瀏覽器不會接觸任何憑證',
    checking: '檢查中',
    connected: '已連線',
    unavailable: '狀態不可用',
    pending: '待設定',
    checkingDescription: '正在檢查 Appwrite Function 的 AI 連線狀態…',
    readyPrefix: '目前使用',
    changeHint: '。如需切換，請在 Appwrite Console 的 matrixflow-core 函數變數中修改協議與金鑰。',
    unavailableDescription: '暫時無法讀取連線狀態，請稍後重新整理重試。',
    configurePrefix: '管理員設定 ',
    configureSuffix: ' 後，重新部署函數即可啟用。',
    logout: '登出目前帳號',
    sessionsTitle: '登入裝置管理',
    sessionsDescription: '查看並撤銷目前帳號的其他登入工作階段。',
    sessionsLoading: '正在載入登入工作階段…',
    sessionsEmpty: '暫無其他登入工作階段',
    currentSession: '目前裝置',
    revokeSession: '撤銷',
    revokeOthers: '撤銷其他裝置',
    sessionsRevoked: '其他登入工作階段已撤銷',
    sessionsFailed: '無法管理登入工作階段，請稍後重試',
  },
  en: {
    title: 'Settings',
    description: 'Manage your identity, organization configuration, and system integrations',
    tabs: { profile: 'Profile & avatar', enterprise: 'Organization & security' },
    preview: 'Avatar and work identity',
    previewDescription: 'Synced to the sidebar and workspace status',
    workName: 'Work name',
    workNamePlaceholder: 'e.g. Operations lead',
    avatarStyle: 'Choose a Morandi-style avatar',
    avatarHosted: 'Or use an Appwrite-hosted avatar URL',
    saving: 'Saving…',
    save: 'Save changes',
    nameRequired: 'Name is required',
    profileSaved: 'Profile and avatar saved.',
    saveFailed: 'Save failed. Try again later.',
    orgPermissions: 'Organization permissions',
    orgDescription: 'Your current organization scope and role',
    orgName: 'Organization',
    noOrg: 'No organization selected',
    role: 'Role',
    unassigned: 'Unassigned',
    currentOrg: 'Current workspace',
    orgHint: 'Future API requests are automatically scoped to the selected organization.',
    createTeam: 'Create a team',
    createTeamDescription: 'Create an isolated data and permission space, then switch to it.',
    teamName: 'Team name',
    teamNamePlaceholder: 'e.g. North America operations',
    creating: 'Working…',
    create: 'Create team',
    inviteTeam: 'Invite a team member',
    inviteAllowed: 'Appwrite will send an invitation email with a secure verification link.',
    inviteDenied: 'Only an owner or administrator can invite members.',
    memberEmail: 'Member email',
    memberRole: 'Member role',
    member: 'Member',
    admin: 'Administrator',
    invite: 'Invite',
    inviteSent: 'Team invitation sent.',
    inviteFailed: 'Could not send the team invitation.',
    protocolTitle: 'AI protocol connection',
    protocolDescription: 'Model keys are secured by Appwrite Function and never reach the browser',
    checking: 'Checking',
    connected: 'Connected',
    unavailable: 'Unavailable',
    pending: 'Needs setup',
    checkingDescription: 'Checking the AI connection in Appwrite Function…',
    readyPrefix: 'Using',
    changeHint:
      '. To switch, edit the protocol and key variables in the matrixflow-core Appwrite Function.',
    unavailableDescription: 'The connection status is unavailable. Refresh and try again.',
    configurePrefix: 'An administrator must configure ',
    configureSuffix: ' then redeploy the function to enable it.',
    logout: 'Log out',
    sessionsTitle: 'Signed-in devices',
    sessionsDescription: 'Review and revoke other active sessions for this account.',
    sessionsLoading: 'Loading signed-in sessions…',
    sessionsEmpty: 'No other active sessions',
    currentSession: 'This device',
    revokeSession: 'Revoke',
    revokeOthers: 'Revoke other devices',
    sessionsRevoked: 'Other sessions revoked',
    sessionsFailed: 'Could not manage sessions. Try again later.',
  },
};

const PRESET_AVATARS = [
  { id: 'slate', color: '#607987', labels: { 'zh-CN': '柔蓝', 'zh-TW': '柔藍', en: 'Slate' } },
  { id: 'rose', color: '#ba7678', labels: { 'zh-CN': '落粉', 'zh-TW': '落粉', en: 'Rose' } },
  { id: 'sage', color: '#7b8672', labels: { 'zh-CN': '黛绿', 'zh-TW': '黛綠', en: 'Sage' } },
  { id: 'camel', color: '#bd9b70', labels: { 'zh-CN': '驼黄', 'zh-TW': '駝黃', en: 'Camel' } },
  {
    id: 'terracotta',
    color: '#a36d65',
    labels: { 'zh-CN': '赭红', 'zh-TW': '赭紅', en: 'Terracotta' },
  },
  { id: 'clay', color: '#888481', labels: { 'zh-CN': '烟灰', 'zh-TW': '煙灰', en: 'Clay' } },
];

function makeSvgAvatar(color: string): string {
  // Return an SVG data URI
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${encodeURIComponent(color)}"/><circle cx="50" cy="38" r="18" fill="white" opacity="0.9"/><path d="M18 80c0-12 12-20 32-20s32 8 32 20" fill="white" opacity="0.9"/></svg>`;
  return `data:image/svg+xml;utf8,${svg}`;
}

export default function SettingsPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
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
  const [sessions, setSessions] = useState<
    Array<{
      $id: string;
      current?: boolean;
      clientName?: string;
      deviceName?: string;
      osName?: string;
      expire?: string;
    }>
  >([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
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

  useEffect(() => {
    if (activeTab !== 'enterprise') return;
    let active = true;
    setSessionsLoading(true);
    void account
      .listSessions()
      .then((result) => {
        if (active) setSessions(result.sessions);
      })
      .catch(() => {
        if (active) setSessions([]);
      })
      .finally(() => {
        if (active) setSessionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeTab]);

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
      toast.error(copy.nameRequired);
      return;
    }
    setSaving(true);
    try {
      await updateProfile(name, avatarUrl);
      toast.success(copy.profileSaved);
    } catch (err: unknown) {
      toast.error(errorMessage(err, copy.saveFailed));
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
      toast.success(
        locale === 'en'
          ? 'Team created and selected.'
          : locale === 'zh-TW'
            ? '團隊已建立並切換'
            : '团队已创建并切换',
      );
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          locale === 'en'
            ? 'Could not create the team.'
            : locale === 'zh-TW'
              ? '團隊建立失敗'
              : '团队创建失败',
        ),
      );
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
      toast.success(copy.inviteSent);
    } catch (error) {
      toast.error(errorMessage(error, copy.inviteFailed));
    } finally {
      setTeamPending(false);
    }
  }

  async function handleRevokeSession(sessionId: string) {
    try {
      await account.deleteSession({ sessionId });
      setSessions((current) => current.filter((session) => session.$id !== sessionId));
    } catch (error) {
      toast.error(errorMessage(error, copy.sessionsFailed));
    }
  }

  async function handleRevokeOthers() {
    try {
      await account.deleteSessions();
      toast.success(copy.sessionsRevoked);
      await logout();
    } catch (error) {
      toast.error(errorMessage(error, copy.sessionsFailed));
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="border-b border-border/40 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          {copy.title}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">{copy.description}</p>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label={copy.title}
        className="flex gap-4 border-b border-border/60 text-xs font-semibold"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'profile'}
          onClick={() => setActiveTab('profile')}
          className={`border-b-2 px-1 pb-2.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            activeTab === 'profile'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {copy.tabs.profile}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'enterprise'}
          onClick={() => setActiveTab('enterprise')}
          className={`border-b-2 px-1 pb-2.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            activeTab === 'enterprise'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {copy.tabs.enterprise}
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
                    alt={copy.preview}
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
                <h3 className="text-sm font-bold text-foreground">{copy.preview}</h3>
                <p className="text-2xs text-muted-foreground mt-0.5">{copy.previewDescription}</p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="profileName" className="text-xs font-semibold text-foreground">
                  {copy.workName}
                </Label>
                <Input
                  id="profileName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={copy.workNamePlaceholder}
                  required
                  className="bg-muted/20 border-border/60 focus-visible:ring-primary/30"
                />
              </div>

              {/* Presets Grid */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">{copy.avatarStyle}</Label>
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
                        title={p.labels[locale]}
                      >
                        <div
                          className="h-7 w-7 rounded-full shadow-sm border border-black/5"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="text-[10px] text-muted-foreground mt-1.5 group-hover:text-foreground font-medium">
                          {p.labels[locale]}
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
                  {copy.avatarHosted}
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
              {saving ? copy.saving : copy.save}
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
                <h3 className="text-xs font-bold text-foreground">{copy.orgPermissions}</h3>
                <p className="text-2xs text-muted-foreground mt-0.5">{copy.orgDescription}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-muted/10 p-3 rounded-lg border border-border/40">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase">
                  {copy.orgName}
                </p>
                <p className="font-bold text-foreground mt-1">
                  {membership?.organizationName ?? copy.noOrg}
                </p>
              </div>
              <div className="bg-muted/10 p-3 rounded-lg border border-border/40">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase">
                  {copy.role}
                </p>
                <p className="font-bold text-primary mt-1 flex items-center gap-1">
                  {membership?.role ?? copy.unassigned}
                </p>
              </div>
            </div>
            {user && user.memberships.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="organization" className="text-xs font-semibold text-foreground">
                  {copy.currentOrg}
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
                <p className="text-[0.6875rem] text-muted-foreground">{copy.orgHint}</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4 border-b border-border/40 pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">{copy.sessionsTitle}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {copy.sessionsDescription}
                </p>
              </div>
              {sessions.length > 1 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleRevokeOthers()}
                >
                  {copy.revokeOthers}
                </Button>
              )}
            </div>
            {sessionsLoading ? (
              <p className="text-xs text-muted-foreground">{copy.sessionsLoading}</p>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground">{copy.sessionsEmpty}</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.$id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {session.current
                          ? copy.currentSession
                          : session.deviceName || session.clientName || 'Appwrite'}
                      </p>
                      <p className="truncate text-2xs text-muted-foreground">
                        {[session.clientName, session.osName].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {!session.current && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleRevokeSession(session.$id)}
                      >
                        {copy.revokeSession}
                      </Button>
                    )}
                  </div>
                ))}
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
                <h3 className="text-sm font-bold">{copy.createTeam}</h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {copy.createTeamDescription}
              </p>
              <Label htmlFor="new-team-name" className="mt-4 block text-xs">
                {copy.teamName}
              </Label>
              <Input
                id="new-team-name"
                className="mt-2"
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                placeholder={copy.teamNamePlaceholder}
              />
              <Button
                type="submit"
                variant="outline"
                className="mt-3 w-full"
                disabled={!teamName.trim() || teamPending}
              >
                {teamPending ? copy.creating : copy.create}
              </Button>
            </form>

            <form
              onSubmit={handleInvite}
              className="rounded-xl border border-border/60 bg-card p-5 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold">{copy.inviteTeam}</h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {canInvite ? copy.inviteAllowed : copy.inviteDenied}
              </p>
              <Label htmlFor="invite-email" className="mt-4 block text-xs">
                {copy.memberEmail}
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
                  aria-label={copy.memberRole}
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as 'member' | 'admin')}
                  disabled={!canInvite}
                  className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="member">{copy.member}</option>
                  <option value="admin">{copy.admin}</option>
                </select>
                <Button type="submit" disabled={!canInvite || !inviteEmail.trim() || teamPending}>
                  <Mail className="h-4 w-4" /> {copy.invite}
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
                  <p className="text-xs font-bold text-foreground">{copy.protocolTitle}</p>
                  <p className="text-2xs text-muted-foreground mt-0.5">
                    {copy.protocolDescription}
                  </p>
                </div>
              </div>
              {aiStatusLoading ? (
                <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                  {copy.checking}
                </span>
              ) : aiStatus?.ready ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-bold text-success">
                  <CircleCheck className="h-3 w-3" /> {copy.connected}
                </span>
              ) : aiStatusError ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                  <CircleAlert className="h-3 w-3" /> {copy.unavailable}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1 text-[10px] font-bold text-warning">
                  <CircleAlert className="h-3 w-3" /> {copy.pending}
                </span>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ['Anthropic', 'Messages API'],
                ['OpenAI', 'Chat Completions'],
                [
                  locale === 'en'
                    ? 'Compatible gateway'
                    : locale === 'zh-TW'
                      ? '相容閘道'
                      : '兼容网关',
                  'GLM / vLLM / LiteLLM',
                ],
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
                {copy.checkingDescription}
              </p>
            ) : aiStatus?.ready ? (
              <p className="text-[11px] leading-5 text-muted-foreground">
                {copy.readyPrefix}{' '}
                <span className="font-semibold text-foreground">{aiStatus.provider}</span>
                {aiStatus.protocol ? ` · ${aiStatus.protocol}` : ''}
                {aiStatus.model ? ` · ${aiStatus.model}` : ''}
                {copy.changeHint}
              </p>
            ) : (
              <p className="text-[11px] leading-5 text-muted-foreground">
                {aiStatusError ? copy.unavailableDescription : copy.configurePrefix}
                {!aiStatusError && (
                  <>
                    <span className="font-semibold text-foreground">ANTHROPIC_API_KEY</span>、
                    <span className="font-semibold text-foreground">OPENAI_API_KEY</span> 或
                    <span className="font-semibold text-foreground">GLM_API_KEY</span>
                    {copy.configureSuffix}
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
              <LogOut className="h-3.5 w-3.5" /> {copy.logout}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
