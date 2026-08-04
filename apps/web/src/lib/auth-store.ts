import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient, clearAppwriteCache, clearOrganizationContext } from '@/lib/api-client';
import { account } from './appwrite';
import { ID } from 'appwrite';

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  memberships: {
    organizationId: string;
    organizationName: string;
    slug: string;
    role: string;
    permissions: string[];
  }[];
}

interface AuthState {
  user: User | null;
  organizationId: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  registerWithOtp: (email: string, password: string, name: string) => Promise<string>;
  sendOtp: (email: string) => Promise<string>;
  verifyOtp: (userId: string, code: string, name?: string) => Promise<void>;
  updateProfile: (name: string, avatarUrl: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  setOrg: (orgId: string) => void;
  hasPerm: (action: string) => boolean;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      organizationId: null,
      loading: false,

      login: async (email, password) => {
        set({ loading: true });
        try {
          clearAppwriteCache();
          clearOrganizationContext();
          set({ user: null, organizationId: null });
          await account.deleteSession('current').catch(() => {});
          await account.createEmailPasswordSession(email, password);
          await get().fetchMe();
        } finally {
          set({ loading: false });
        }
      },

      register: async (email, password, name) => {
        set({ loading: true });
        try {
          clearAppwriteCache();
          clearOrganizationContext();
          set({ user: null, organizationId: null });
          await account.deleteSession('current').catch(() => {});
          await account.create(ID.unique(), email, password, name);
          await account.createEmailPasswordSession(email, password);
          await get().fetchMe();
        } finally {
          set({ loading: false });
        }
      },

      registerWithOtp: async (email, password, name) => {
        set({ loading: true });
        try {
          clearAppwriteCache();
          clearOrganizationContext();
          set({ user: null, organizationId: null });
          await account.deleteSession('current').catch(() => {});
          const userId = ID.unique();
          await account.create(userId, email, password, name);
          const token = await account.createEmailToken(userId, email);
          return token.userId;
        } finally {
          set({ loading: false });
        }
      },

      sendOtp: async (email) => {
        set({ loading: true });
        try {
          clearAppwriteCache();
          clearOrganizationContext();
          set({ user: null, organizationId: null });
          await account.deleteSession('current').catch(() => {});
          const token = await account.createEmailToken(ID.unique(), email);
          return token.userId;
        } finally {
          set({ loading: false });
        }
      },

      verifyOtp: async (userId, code, name) => {
        set({ loading: true });
        try {
          clearAppwriteCache();
          await account.createSession(userId, code);
          if (name) {
            await account.updateName(name).catch(() => {});
          }
          await get().fetchMe();
        } finally {
          set({ loading: false });
        }
      },

      updateProfile: async (name, avatarUrl) => {
        set({ loading: true });
        try {
          const updatedUser = await apiClient.put<User>('/auth/me', { name, avatarUrl });
          await account.updateName(name).catch(() => {});
          set({ user: updatedUser });
        } finally {
          set({ loading: false });
        }
      },

      logout: async () => {
        clearAppwriteCache();
        clearOrganizationContext();
        await account.deleteSession('current').catch(() => {});
        set({ user: null, organizationId: null });
      },

      fetchMe: async () => {
        try {
          const me = await apiClient.get<User>('/auth/me');
          const orgId = me.memberships[0]?.organizationId ?? null;
          set({ user: me, organizationId: orgId });
        } catch {
          set({ user: null, organizationId: null });
        }
      },

      setOrg: (orgId) => {
        set({ organizationId: orgId });
      },

      hasPerm: (action) => {
        const { user, organizationId } = get();
        const m = user?.memberships.find((m) => m.organizationId === organizationId);
        return m?.permissions.includes(action) ?? false;
      },
    }),
    { name: 'mfa-auth', partialize: (s) => ({ organizationId: s.organizationId }) },
  ),
);
