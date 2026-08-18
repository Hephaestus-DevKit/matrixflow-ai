'use client';

import { useEffect, useState } from 'react';
import { AuthenticatorType } from 'appwrite';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { account } from '@/lib/appwrite';
import { errorMessage } from '@/lib/errors';
import { useLocale, type Locale } from '@/lib/i18n';

const COPY: Record<
  Locale,
  {
    title: string;
    description: string;
    enabledStatus: string;
    disabledStatus: string;
    unavailableStatus: string;
    loadingStatus: string;
    unavailableDescription: string;
    start: string;
    setupTitle: string;
    setupDescription: string;
    secret: string;
    otp: string;
    enable: string;
    disable: string;
    enabled: string;
    disabled: string;
    failed: string;
    recoveryTitle: string;
    recoveryDescription: string;
    recoveryWarning: string;
    regenerate: string;
    regenerated: string;
    regenerateConfirm: string;
    cancel: string;
    working: string;
  }
> = {
  'zh-CN': {
    title: '双重验证（TOTP）',
    description: '为账号增加一层身份验证器保护，登录时需要输入动态验证码。',
    enabledStatus: '已启用',
    disabledStatus: '未启用',
    unavailableStatus: '状态不可用',
    loadingStatus: '检查中',
    unavailableDescription: '暂时无法读取 MFA 状态，请刷新后重试。',
    start: '设置身份验证器',
    setupTitle: '绑定身份验证器',
    setupDescription: '在身份验证器应用中添加下方链接或密钥，然后输入 6 位验证码完成绑定。',
    secret: '手动密钥',
    otp: '验证码',
    enable: '启用双重验证',
    disable: '关闭双重验证',
    enabled: '双重验证已启用',
    disabled: '双重验证已关闭',
    failed: '双重验证设置失败，请检查验证码后重试',
    recoveryTitle: '恢复代码',
    recoveryDescription: '请立即保存这些一次性恢复代码；设备丢失时可用于登录。',
    recoveryWarning: '恢复代码只显示这一次，离开页面后将无法再次查看。',
    regenerate: '重新生成恢复代码',
    regenerated: '新的恢复代码已生成，旧代码已失效',
    regenerateConfirm: '重新生成后，之前保存的恢复代码将立即失效。确定继续吗？',
    cancel: '取消设置',
    working: '处理中…',
  },
  'zh-TW': {
    title: '雙重驗證（TOTP）',
    description: '為帳號增加一層驗證器保護，登入時需要輸入動態驗證碼。',
    enabledStatus: '已啟用',
    disabledStatus: '未啟用',
    unavailableStatus: '狀態不可用',
    loadingStatus: '檢查中',
    unavailableDescription: '暫時無法讀取 MFA 狀態，請重新整理後再試。',
    start: '設定驗證器',
    setupTitle: '綁定驗證器',
    setupDescription: '在驗證器應用程式中加入下方連結或密鑰，然後輸入 6 位驗證碼完成綁定。',
    secret: '手動密鑰',
    otp: '驗證碼',
    enable: '啟用雙重驗證',
    disable: '關閉雙重驗證',
    enabled: '雙重驗證已啟用',
    disabled: '雙重驗證已關閉',
    failed: '雙重驗證設定失敗，請檢查驗證碼後再試',
    recoveryTitle: '恢復代碼',
    recoveryDescription: '請立即保存這些一次性恢復代碼；裝置遺失時可用於登入。',
    recoveryWarning: '恢復代碼只會顯示這一次，離開頁面後將無法再次查看。',
    regenerate: '重新產生恢復代碼',
    regenerated: '新的恢復代碼已產生，舊代碼已失效',
    regenerateConfirm: '重新產生後，先前保存的恢復代碼將立即失效。確定繼續嗎？',
    cancel: '取消設定',
    working: '處理中…',
  },
  en: {
    title: 'Two-step verification (TOTP)',
    description:
      'Add authenticator protection to your account. Sign-in will require a rotating code.',
    enabledStatus: 'Enabled',
    disabledStatus: 'Not enabled',
    unavailableStatus: 'Unavailable',
    loadingStatus: 'Checking',
    unavailableDescription: 'MFA status is unavailable. Refresh and try again.',
    start: 'Set up authenticator',
    setupTitle: 'Link an authenticator',
    setupDescription:
      'Add the link or secret below to your authenticator app, then enter the 6-digit code to finish.',
    secret: 'Manual secret',
    otp: 'Verification code',
    enable: 'Enable two-step verification',
    disable: 'Disable two-step verification',
    enabled: 'Two-step verification enabled',
    disabled: 'Two-step verification disabled',
    failed: 'Could not set up two-step verification. Check the code and try again.',
    recoveryTitle: 'Recovery codes',
    recoveryDescription:
      'Save these one-time recovery codes now. They can help you sign in if you lose your device.',
    recoveryWarning:
      'Recovery codes are shown only once and cannot be viewed again after leaving this page.',
    regenerate: 'Regenerate recovery codes',
    regenerated: 'New recovery codes created. Previous codes no longer work.',
    regenerateConfirm: 'Previously saved recovery codes will stop working. Continue?',
    cancel: 'Cancel setup',
    working: 'Working…',
  },
};

export function MfaSecurityCard() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const [status, setStatus] = useState<'loading' | 'enabled' | 'disabled' | 'unavailable'>(
    'loading',
  );
  const [setup, setSetup] = useState<{ uri: string; secret: string } | null>(null);
  const [otp, setOtp] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<'disable' | 'regenerate' | null>(null);

  useEffect(() => {
    let active = true;
    void account
      .get()
      .then((current) => {
        if (active) setStatus(current.mfa ? 'enabled' : 'disabled');
      })
      .catch(() => {
        if (active) setStatus('unavailable');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function createAuthenticator() {
    try {
      return await account.createMFAAuthenticator({ type: AuthenticatorType.Totp });
    } catch (error) {
      const candidate = error as { code?: number; type?: string };
      const isExisting =
        candidate.code === 409 || candidate.type === 'user_authenticator_already_exists';
      if (!isExisting) throw error;
      await account.deleteMFAAuthenticator({ type: AuthenticatorType.Totp });
      return account.createMFAAuthenticator({ type: AuthenticatorType.Totp });
    }
  }

  async function handleStart() {
    setLoading(true);
    setRecoveryCodes([]);
    try {
      const result = await createAuthenticator();
      setSetup({ uri: result.uri, secret: result.secret });
    } catch (error) {
      toast.error(errorMessage(error, copy.failed));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    if (!setup || otp.trim().length !== 6) return;
    setLoading(true);
    try {
      await account.updateMFAAuthenticator({ type: AuthenticatorType.Totp, otp: otp.trim() });
      await account.updateMFA({ mfa: true });
      const recovery = await account.createMFARecoveryCodes().catch(() => null);
      setRecoveryCodes(recovery?.recoveryCodes ?? []);
      setStatus('enabled');
      setSetup(null);
      setOtp('');
      toast.success(copy.enabled);
    } catch (error) {
      toast.error(errorMessage(error, copy.failed));
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    setLoading(true);
    try {
      await account.updateMFA({ mfa: false });
      await account.deleteMFAAuthenticator({ type: AuthenticatorType.Totp }).catch(() => undefined);
      setStatus('disabled');
      setSetup(null);
      setOtp('');
      setRecoveryCodes([]);
      toast.success(copy.disabled);
    } catch (error) {
      toast.error(errorMessage(error, copy.failed));
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  }

  async function handleRegenerateRecoveryCodes() {
    setLoading(true);
    try {
      const recovery = await account.updateMFARecoveryCodes();
      setRecoveryCodes(recovery.recoveryCodes);
      toast.success(copy.regenerated);
    } catch (error) {
      toast.error(errorMessage(error, copy.failed));
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  }

  async function handleCancel() {
    setLoading(true);
    try {
      await account.deleteMFAAuthenticator({ type: AuthenticatorType.Totp });
      setSetup(null);
      setOtp('');
    } catch (error) {
      toast.error(errorMessage(error, copy.failed));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="surface-card space-y-4 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4 border-b border-border/40 pb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/10 bg-primary/5 text-primary">
            <ShieldCheck className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">{copy.title}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.description}</p>
          </div>
        </div>
        <span
          className={`status-pill shrink-0 font-bold ${status === 'enabled' ? 'border-success/10 bg-success/10 text-success' : 'border-transparent bg-muted text-muted-foreground'}`}
        >
          {status === 'loading'
            ? copy.loadingStatus
            : status === 'enabled'
              ? copy.enabledStatus
              : status === 'unavailable'
                ? copy.unavailableStatus
                : copy.disabledStatus}
        </span>
      </div>

      {status === 'unavailable' && (
        <p className="text-xs leading-5 text-muted-foreground">{copy.unavailableDescription}</p>
      )}

      {status === 'disabled' && !setup && (
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleStart()}
          disabled={loading}
        >
          {loading ? copy.working : copy.start}
        </Button>
      )}

      {setup && (
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-xs font-bold text-foreground">{copy.setupTitle}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.setupDescription}</p>
            <div className="mt-3 space-y-2 text-xs">
              <p className="font-semibold text-foreground">{copy.secret}</p>
              <code className="block break-all rounded-lg bg-background px-3 py-2 font-mono text-2xs text-foreground">
                {setup.secret}
              </code>
              <a href={setup.uri} className="block break-all text-2xs text-primary hover:underline">
                {setup.uri}
              </a>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mfa-setup-otp" className="text-xs">
              {copy.otp}
            </Label>
            <Input
              id="mfa-setup-otp"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="font-mono tracking-[0.3em]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={loading || otp.length !== 6}>
              {loading ? copy.working : copy.enable}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void handleCancel()}
              disabled={loading}
            >
              {copy.cancel}
            </Button>
          </div>
        </form>
      )}

      {status === 'enabled' && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmAction('regenerate')}
            disabled={loading}
          >
            {loading ? copy.working : copy.regenerate}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setConfirmAction('disable')}
            disabled={loading}
          >
            {copy.disable}
          </Button>
        </div>
      )}

      {recoveryCodes.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
          <p className="text-xs font-bold text-foreground">{copy.recoveryTitle}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.recoveryDescription}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-background p-3 font-mono text-xs text-foreground sm:grid-cols-3">
            {recoveryCodes.map((code) => (
              <code key={code}>{code}</code>
            ))}
          </div>
          <p className="mt-2 text-2xs text-warning">{copy.recoveryWarning}</p>
        </div>
      )}
      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction === 'disable' ? copy.disable : copy.regenerate}
        description={confirmAction === 'disable' ? copy.disable : copy.regenerateConfirm}
        confirmLabel={confirmAction === 'disable' ? copy.disable : copy.regenerate}
        cancelLabel={copy.cancel}
        busy={loading}
        onCancel={() => {
          if (!loading) setConfirmAction(null);
        }}
        onConfirm={() => {
          if (confirmAction === 'disable') void handleDisable();
          if (confirmAction === 'regenerate') void handleRegenerateRecoveryCodes();
        }}
      />
    </div>
  );
}
