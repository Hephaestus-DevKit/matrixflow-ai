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
];

function slugify(value: string, fallback: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || fallback;
}

export async function getCurrentIdentity(): Promise<MatrixFlowUser> {
  const current = await account.get();
  if (!current.emailVerification) throw new Error('邮箱尚未完成验证，请使用邮箱验证码登录');

  let teamList = await teams.list();
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
        permissions:
          role === 'member' ? ALL_PERMISSIONS.filter((p) => p !== 'billing.read') : ALL_PERMISSIONS,
      };
    }),
  );

  const prefs = current.prefs as { avatarUrl?: unknown };
  return {
    id: current.$id,
    email: current.email,
    name: current.name || current.email.split('@')[0],
    avatarUrl: typeof prefs.avatarUrl === 'string' ? prefs.avatarUrl : null,
    memberships,
  };
}

export async function updateCurrentProfile(name: string, avatarUrl: string) {
  const current = await account.get();
  const nextName = name.trim();
  if (!nextName) throw new Error('姓名不能为空');
  if (nextName !== current.name) await account.updateName({ name: nextName });
  await account.updatePrefs({
    prefs: { ...(current.prefs as Record<string, unknown>), avatarUrl: avatarUrl.trim() || null },
  });
  return getCurrentIdentity();
}
