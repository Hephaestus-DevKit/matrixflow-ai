import { ID, Query } from 'appwrite';
import { account, teams } from '@/lib/appwrite';

export interface MatrixFlowUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    slug: string;
    role: string;
    permissions: string[];
  }>;
}

const ALL_PERMISSIONS = [
  'agents.manage',
  'content.manage',
  'knowledge.manage',
  'workflows.manage',
  'crm.manage',
  'marketplace.manage',
  'billing.read',
  'billing.manage',
  'admin.manage',
];

const MEMBER_PERMISSIONS = ALL_PERMISSIONS.filter(
  (permission) => !['marketplace.manage', 'billing.manage', 'admin.manage'].includes(permission),
);

function normalizeAvatarUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (value.startsWith('data:image/svg+xml,') && value.length <= 4_096) return value;
  try {
    const url = new URL(value);
    const allowed =
      url.protocol === 'https:' &&
      (url.hostname === 'sgp.cloud.appwrite.io' || url.hostname === 'cloud.appwrite.io');
    return allowed ? url.toString() : null;
  } catch {
    return null;
  }
}

function slugify(value: string, fallback: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || fallback;
}

export async function getCurrentIdentity(): Promise<MatrixFlowUser> {
  // These two independent reads can share one network round trip. This is
  // especially noticeable on a cold dashboard load over a distant region.
  const [current, initialTeamList] = await Promise.all([account.get(), teams.list()]);
  if (!current.emailVerification) throw new Error('邮箱尚未完成验证，请使用邮箱验证码登录');

  let teamList = initialTeamList;
  if (teamList.teams.length === 0) {
    await teams.create({
      teamId: ID.unique(),
      name: `${current.name || current.email.split('@')[0]} 的团队`,
      roles: ['owner', 'admin'],
    });
    teamList = await teams.list();
  }

  const memberships = await Promise.all(
    teamList.teams.map(async (team) => {
      const result = await teams.listMemberships({
        teamId: team.$id,
        queries: [Query.equal('userId', current.$id), Query.limit(1)],
      });
      const roles = result.memberships[0]?.roles ?? ['member'];
      const role = roles.includes('owner')
        ? 'owner'
        : roles.includes('admin')
          ? 'admin'
          : roles[0] || 'member';
      return {
        organizationId: team.$id,
        organizationName: team.name,
        slug: slugify(team.name, team.$id.slice(0, 8)),
        role,
        permissions: role === 'member' ? MEMBER_PERMISSIONS : ALL_PERMISSIONS,
      };
    }),
  );

  const prefs = current.prefs as { avatarUrl?: unknown };
  return {
    id: current.$id,
    email: current.email,
    name: current.name || current.email.split('@')[0],
    avatarUrl: normalizeAvatarUrl(prefs.avatarUrl),
    memberships,
  };
}

export async function updateCurrentProfile(name: string, avatarUrl: string) {
  const current = await account.get();
  const nextName = name.trim();
  if (!nextName) throw new Error('姓名不能为空');
  const normalizedAvatar = normalizeAvatarUrl(avatarUrl);
  if (avatarUrl.trim() && !normalizedAvatar)
    throw new Error('头像仅支持内置头像或 Appwrite 托管的 HTTPS 地址');
  if (nextName !== current.name) await account.updateName({ name: nextName });
  await account.updatePrefs({
    prefs: { ...(current.prefs as Record<string, unknown>), avatarUrl: normalizedAvatar },
  });
  return getCurrentIdentity();
}

export async function createOrganization(name: string) {
  const normalized = name.trim();
  if (!normalized) throw new Error('团队名称不能为空');
  const team = await teams.create({
    teamId: ID.unique(),
    name: normalized,
    roles: ['owner', 'admin'],
  });
  return team.$id;
}

export async function inviteOrganizationMember(
  organizationId: string,
  email: string,
  role: 'member' | 'admin',
  redirectUrl: string,
) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error('请输入有效邮箱');
  await teams.createMembership({
    teamId: organizationId,
    email: normalizedEmail,
    roles: [role],
    url: redirectUrl,
  });
}
