import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearAppwriteCache, clearOrganizationContext } from '@/lib/api-client';
import { setOrganizationContext } from '@/lib/backend/organization-context';
import {
  getCurrentIdentity,
  createOrganization,
  inviteOrganizationMember,
  updateCurrentProfile,
  type MatrixFlowUser,
} from '@/lib/backend/session';
import { account } from './appwrite';
import { AuthenticationFactor, ID } from 'appwrite';

type User = MatrixFlowUser;
type MfaFactor = 'totp' | 'recoverycode';

interface AuthState {
  user: User | null;
  organizationId: string | null;
  pendingMfaChallengeId: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  startMfaChallenge: (factor: MfaFactor) => Promise<void>;
  completeMfa: (otp: string) => Promise<void>;
  registerWithOtp: (email: string, password: string, name: string) => Promise<string>;
  sendOtp: (email: string) => Promise<string>;
  requestPasswordRecovery: (email: string) => Promise<void>;
  resetPassword: (userId: string, secret: string, password: string) => Promise<void>;
  verifyOtp: (userId: string, code: string, name?: string) => Promise<void>;
  updateProfile: (name: string, avatarUrl: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: (timeoutMs?: number) => Promise<User>;
  setOrg: (orgId: string) => void;
  hasPerm: (action: string) => boolean;
  createTeam: (name: string) => Promise<void>;
  inviteMember: (email: string, role: 'member' | 'admin') => Promise<void>;
}

interface AppwriteErrorLike {
  code?: number;
  type?: string;
}

interface MfaRequiredError extends Error {
  code: 'MFA_REQUIRED';
  challengeId: string;
}

const AUTH_BOOTSTRAP_TIMEOUT_MS = 4_000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          const timeout = new Error('AUTH_BOOTSTRAP_TIMEOUT') as Error & { code: string };
          timeout.code = 'AUTH_BOOTSTRAP_TIMEOUT';
          reject(timeout);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isExistingAccount(error: unknown): boolean {
  const candidate = error as AppwriteErrorLike;
  return candidate.code === 409 || candidate.type === 'user_already_exists';
}

async function clearSession() {
  clearAppwriteCache();
  await account.deleteSession({ sessionId: 'current' }).catch(() => undefined);
}

async function requireVerifiedAccount() {
  const current = await account.get();
  if (!current.emailVerification) {
    throw new Error('邮箱尚未完成验证，请使用邮箱验证码登录');
  }
  return current;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      organizationId: null,
      pendingMfaChallengeId: null,
      loading: false,

      login: async (email, password) => {
        set({ loading: true });
        try {
          await clearSession();
          clearOrganizationContext();
          set({ user: null, organizationId: null, pendingMfaChallengeId: null });
          await account.createEmailPasswordSession({ email, password });
          const current = await requireVerifiedAccount();
          if (current.mfa) {
            await get().startMfaChallenge('totp');
            const mfaError = new Error('MFA_REQUIRED') as MfaRequiredError;
            mfaError.code = 'MFA_REQUIRED';
            mfaError.challengeId = get().pendingMfaChallengeId ?? '';
            throw mfaError;
          }
          await get().fetchMe();
        } catch (error) {
          if ((error as Partial<MfaRequiredError>)?.code === 'MFA_REQUIRED') throw error;
          await clearSession();
          set({ user: null, organizationId: null, pendingMfaChallengeId: null });
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      startMfaChallenge: async (factor) => {
        const challenge = await account.createMFAChallenge({
          factor:
            factor === 'recoverycode'
              ? AuthenticationFactor.Recoverycode
              : AuthenticationFactor.Totp,
        });
        set({ pendingMfaChallengeId: challenge.$id });
      },

      completeMfa: async (otp) => {
        const challengeId = get().pendingMfaChallengeId;
        if (!challengeId) {
          const expired = new Error('MFA_CHALLENGE_EXPIRED') as Error & { code: string };
          expired.code = 'MFA_CHALLENGE_EXPIRED';
          throw expired;
        }
        set({ loading: true });
        try {
          await account.updateMFAChallenge({ challengeId, otp });
          set({ pendingMfaChallengeId: null });
          await get().fetchMe();
        } finally {
          set({ loading: false });
        }
      },

      registerWithOtp: async (email, password, name) => {
        set({ loading: true });
        try {
          await clearSession();
          clearOrganizationContext();
          set({ user: null, organizationId: null, pendingMfaChallengeId: null });
          const userId = ID.unique();
          try {
            await account.create({ userId, email, password, name });
          } catch (error) {
            // Allow an interrupted registration to resume verification. Appwrite
            // ignores userId for an email that is already registered.
            if (!isExistingAccount(error)) throw error;
          }
          const token = await account.createEmailToken({ userId, email });
          return token.userId;
        } finally {
          set({ loading: false });
        }
      },

      sendOtp: async (email) => {
        set({ loading: true });
        try {
          await clearSession();
          clearOrganizationContext();
          set({ user: null, organizationId: null, pendingMfaChallengeId: null });
          const token = await account.createEmailToken({ userId: ID.unique(), email });
          return token.userId;
        } finally {
          set({ loading: false });
        }
      },

      requestPasswordRecovery: async (email) => {
        await account.createRecovery(email, `${window.location.origin}/recover`);
      },

      resetPassword: async (userId, secret, password) => {
        await account.updateRecovery(userId, secret, password);
      },

      verifyOtp: async (userId, code, name) => {
        set({ loading: true });
        try {
          clearAppwriteCache();
          await account.createSession({ userId, secret: code });
          const current = await requireVerifiedAccount();
          if (current.mfa) {
            await get().startMfaChallenge('totp');
            const mfaError = new Error('MFA_REQUIRED') as MfaRequiredError;
            mfaError.code = 'MFA_REQUIRED';
            mfaError.challengeId = get().pendingMfaChallengeId ?? '';
            throw mfaError;
          }
          if (name) {
            await account.updateName({ name }).catch(() => undefined);
          }
          await get().fetchMe();
        } catch (error) {
          if ((error as Partial<MfaRequiredError>)?.code === 'MFA_REQUIRED') throw error;
          await clearSession();
          set({ user: null, organizationId: null, pendingMfaChallengeId: null });
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      updateProfile: async (name, avatarUrl) => {
        set({ loading: true });
        try {
          const updatedUser = await updateCurrentProfile(name, avatarUrl);
          set({ user: updatedUser });
        } finally {
          set({ loading: false });
        }
      },

      logout: async () => {
        await clearSession();
        clearOrganizationContext();
        set({ user: null, organizationId: null, pendingMfaChallengeId: null });
      },

      fetchMe: async (timeoutMs = AUTH_BOOTSTRAP_TIMEOUT_MS) => {
        try {
          const me = await withTimeout(getCurrentIdentity(), timeoutMs);
          const persisted = get().organizationId;
          const orgId = me.memberships.some((membership) => membership.organizationId === persisted)
            ? persisted
            : (me.memberships[0]?.organizationId ?? null);
          setOrganizationContext(orgId);
          set({ user: me, organizationId: orgId });
          return me;
        } catch (error) {
          clearOrganizationContext();
          set({ user: null, organizationId: null, pendingMfaChallengeId: null });
          throw error;
        }
      },

      setOrg: (orgId) => {
        const membership = get().user?.memberships.some((item) => item.organizationId === orgId);
        if (!membership) throw new Error('无法切换到未授权的团队空间');
        setOrganizationContext(orgId);
        set({ organizationId: orgId });
      },

      hasPerm: (action) => {
        const { user, organizationId } = get();
        const m = user?.memberships.find((m) => m.organizationId === organizationId);
        return m?.permissions.includes(action) ?? false;
      },

      createTeam: async (name) => {
        const teamId = await createOrganization(name);
        await get().fetchMe();
        get().setOrg(teamId);
      },

      inviteMember: async (email, role) => {
        const organizationId = get().organizationId;
        if (!organizationId) throw new Error('请先选择团队');
        await inviteOrganizationMember(
          organizationId,
          email,
          role,
          `${window.location.origin}/invite`,
        );
      },
    }),
    {
      name: 'matrixflow-auth',
      // The Appwrite session is the source of truth. Persisting a full user
      // object can briefly render stale identity data after a session expires.
      partialize: (state) => ({ organizationId: state.organizationId }),
    },
  ),
);
