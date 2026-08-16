'use client';

import { useEffect, useState } from 'react';
import { Check, Clipboard, KeyRound, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { useLocale, type Locale } from '@/lib/i18n';

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdAt?: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
  active: boolean;
};

const SCOPES = [
  'agents.manage',
  'content.manage',
  'knowledge.manage',
  'workflows.manage',
  'crm.manage',
  'billing.read',
] as const;

const COPY: Record<
  Locale,
  {
    title: string;
    description: string;
    adminOnly: string;
    name: string;
    namePlaceholder: string;
    scopes: string;
    create: string;
    creating: string;
    empty: string;
    prefix: string;
    created: string;
    lastUsed: string;
    never: string;
    expires: string;
    revoked: string;
    revoke: string;
    revokeConfirm: string;
    createdSuccess: string;
    secretWarning: string;
    copy: string;
    copied: string;
    loadFailed: string;
    createFailed: string;
    revokeFailed: string;
    cancel: string;
    scopeLabels: Record<(typeof SCOPES)[number], string>;
  }
> = {
  'zh-CN': {
    title: 'API 访问',
    description: '为自动化脚本和外部系统创建最小权限 API Key。密钥只显示一次。',
    adminOnly: '只有团队所有者或管理员可以管理 API Key。',
    name: '名称',
    namePlaceholder: '例如：生产同步脚本',
    scopes: '权限范围',
    create: '创建 API Key',
    creating: '创建中…',
    empty: '还没有 API Key。',
    prefix: '前缀',
    created: '创建于',
    lastUsed: '最近使用',
    never: '从未使用',
    expires: '到期',
    revoked: '已撤销',
    revoke: '撤销',
    revokeConfirm: '撤销后该密钥会立即失效，确定继续吗？',
    createdSuccess: 'API Key 已创建',
    secretWarning: '请立即复制并安全保存；离开此页面后不会再次显示完整密钥。',
    copy: '复制',
    copied: '已复制',
    loadFailed: '无法加载 API Key',
    createFailed: 'API Key 创建失败',
    revokeFailed: 'API Key 撤销失败',
    cancel: '取消',
    scopeLabels: {
      'agents.manage': 'AI 员工',
      'content.manage': '内容工厂',
      'knowledge.manage': '知识库',
      'workflows.manage': '工作流',
      'crm.manage': 'CRM',
      'billing.read': '计费读取',
    },
  },
  'zh-TW': {
    title: 'API 存取',
    description: '為自動化腳本與外部系統建立最小權限 API Key。密鑰只會顯示一次。',
    adminOnly: '只有團隊擁有者或管理員可以管理 API Key。',
    name: '名稱',
    namePlaceholder: '例如：生產同步腳本',
    scopes: '權限範圍',
    create: '建立 API Key',
    creating: '建立中…',
    empty: '尚未建立 API Key。',
    prefix: '前綴',
    created: '建立於',
    lastUsed: '最近使用',
    never: '從未使用',
    expires: '到期',
    revoked: '已撤銷',
    revoke: '撤銷',
    revokeConfirm: '撤銷後此密鑰會立即失效，確定繼續嗎？',
    createdSuccess: 'API Key 已建立',
    secretWarning: '請立即複製並安全保存；離開此頁面後不會再次顯示完整密鑰。',
    copy: '複製',
    copied: '已複製',
    loadFailed: '無法載入 API Key',
    createFailed: 'API Key 建立失敗',
    revokeFailed: 'API Key 撤銷失敗',
    cancel: '取消',
    scopeLabels: {
      'agents.manage': 'AI 員工',
      'content.manage': '內容工廠',
      'knowledge.manage': '知識庫',
      'workflows.manage': '工作流',
      'crm.manage': 'CRM',
      'billing.read': '計費讀取',
    },
  },
  en: {
    title: 'API access',
    description:
      'Create least-privilege API keys for automations and external systems. Secrets are shown once.',
    adminOnly: 'Only workspace owners and administrators can manage API keys.',
    name: 'Name',
    namePlaceholder: 'e.g. Production sync',
    scopes: 'Scopes',
    create: 'Create API key',
    creating: 'Creating…',
    empty: 'No API keys yet.',
    prefix: 'Prefix',
    created: 'Created',
    lastUsed: 'Last used',
    never: 'Never',
    expires: 'Expires',
    revoked: 'Revoked',
    revoke: 'Revoke',
    revokeConfirm: 'This key will stop working immediately. Continue?',
    createdSuccess: 'API key created',
    secretWarning:
      'Copy and store it now. The full secret will not be shown again after leaving this view.',
    copy: 'Copy',
    copied: 'Copied',
    loadFailed: 'Could not load API keys',
    createFailed: 'Could not create API key',
    revokeFailed: 'Could not revoke API key',
    cancel: 'Cancel',
    scopeLabels: {
      'agents.manage': 'AI workers',
      'content.manage': 'Content factory',
      'knowledge.manage': 'Knowledge bases',
      'workflows.manage': 'Workflows',
      'crm.manage': 'CRM',
      'billing.read': 'Billing read',
    },
  },
};

function formatDate(value: string | null | undefined, locale: Locale, fallback: string) {
  if (!value) return fallback;
  try {
    return new Intl.DateTimeFormat(
      locale === 'en' ? 'en-US' : locale === 'zh-TW' ? 'zh-TW' : 'zh-CN',
      {
        dateStyle: 'medium',
        timeStyle: 'short',
      },
    ).format(new Date(value));
  } catch {
    return fallback;
  }
}

export function ApiAccessCard() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const { organizationId, user } = useAuth();
  const membership = user?.memberships.find((item) => item.organizationId === organizationId);
  const canManage = membership?.role === 'owner' || membership?.role === 'admin';
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['agents.manage', 'workflows.manage']);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId || !canManage) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void apiClient
      .get<ApiKey[]>('/api-keys')
      .then((value) => {
        if (active) setKeys(value);
      })
      .catch(() => {
        if (active) toast.error(copy.loadFailed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [organizationId, canManage, copy.loadFailed]);

  async function create() {
    if (!name.trim() || !scopes.length) return;
    setCreating(true);
    try {
      const result = await apiClient.post<{ key: string; metadata: ApiKey }>('/api-keys', {
        name: name.trim(),
        scopes,
      });
      setKeys((current) => [result.metadata, ...current]);
      setSecret(result.key);
      setName('');
      toast.success(copy.createdSuccess);
    } catch {
      toast.error(copy.createFailed);
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    setRevokingId(id);
    try {
      const updated = await apiClient.del<ApiKey>(`/api-keys/${id}`);
      setKeys((current) => current.map((item) => (item.id === id ? updated : item)));
      setConfirmRevokeId(null);
    } catch {
      toast.error(copy.revokeFailed);
    } finally {
      setRevokingId(null);
    }
  }

  async function copySecret() {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  }

  return (
    <section className="rounded-xl border border-border/60 bg-card p-6 shadow-sm space-y-5">
      <div className="flex items-start gap-3 border-b border-border/40 pb-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <KeyRound className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-foreground">{copy.title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.description}</p>
        </div>
      </div>

      {!canManage ? (
        <p className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
          {copy.adminOnly}
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <Label htmlFor="api-key-name" className="text-xs font-semibold">
                {copy.name}
              </Label>
              <Input
                id="api-key-name"
                className="mt-2"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={copy.namePlaceholder}
                maxLength={100}
              />
            </div>
            <Button
              type="button"
              onClick={() => void create()}
              disabled={!name.trim() || !scopes.length || creating}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {creating ? copy.creating : copy.create}
            </Button>
          </div>
          <fieldset>
            <legend className="text-xs font-semibold text-foreground">{copy.scopes}</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {SCOPES.map((scope) => {
                const checked = scopes.includes(scope);
                return (
                  <label
                    key={scope}
                    className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/10 px-3 py-2 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setScopes((current) =>
                          checked ? current.filter((item) => item !== scope) : [...current, scope],
                        )
                      }
                      className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                    />
                    <span>{copy.scopeLabels[scope]}</span>
                    <code className="ml-auto text-[10px] text-muted-foreground">{scope}</code>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {secret && (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-warning">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" /> {copy.createdSuccess}
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{copy.secretWarning}</p>
              <div className="mt-3 flex gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-background px-3 py-2 text-[11px] text-foreground">
                  {secret}
                </code>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => void copySecret()}
                  aria-label={copied ? copy.copied : copy.copy}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Clipboard className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {loading ? (
              <p className="text-xs text-muted-foreground">{copy.creating}</p>
            ) : keys.length === 0 ? (
              <p className="text-xs text-muted-foreground">{copy.empty}</p>
            ) : (
              keys.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-xs font-semibold text-foreground">{item.name}</p>
                      {!item.active && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          {copy.revoked}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {copy.prefix}: {item.keyPrefix}••••
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {copy.created}: {formatDate(item.createdAt, locale, '')} · {copy.lastUsed}:{' '}
                      {formatDate(item.lastUsedAt, locale, copy.never)}
                      {item.expiresAt
                        ? ` · ${copy.expires}: ${formatDate(item.expiresAt, locale, '')}`
                        : ''}
                    </p>
                  </div>
                  {item.active && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="self-start text-destructive hover:text-destructive sm:self-auto"
                      onClick={() => setConfirmRevokeId(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {copy.revoke}
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
      <ConfirmDialog
        open={Boolean(confirmRevokeId)}
        title={copy.revoke}
        description={copy.revokeConfirm}
        confirmLabel={copy.revoke}
        cancelLabel={copy.cancel}
        busy={Boolean(revokingId)}
        onCancel={() => {
          if (!revokingId) setConfirmRevokeId(null);
        }}
        onConfirm={() => {
          if (confirmRevokeId) void revoke(confirmRevokeId);
        }}
      />
    </section>
  );
}
