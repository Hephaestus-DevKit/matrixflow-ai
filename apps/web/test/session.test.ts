import { getCurrentIdentity, invalidateIdentityRequest } from '../src/lib/backend/session';
import { account, teams } from '../src/lib/appwrite';

jest.mock('../src/lib/appwrite', () => ({
  account: { get: jest.fn() },
  teams: { list: jest.fn(), create: jest.fn(), listMemberships: jest.fn() },
}));

const current = {
  $id: 'user-1',
  email: 'user@example.com',
  name: 'User',
  emailVerification: true,
  prefs: {},
};

beforeEach(() => {
  jest.resetAllMocks();
  invalidateIdentityRequest();
  jest.mocked(account.get).mockResolvedValue(current as never);
  jest.mocked(teams.listMemberships).mockImplementation(async (input) => {
    const { teamId } = input as unknown as { teamId: string };
    return {
      total: 1,
      memberships: [{ userId: 'user-1', teamId, confirm: true, roles: ['member'] }],
    } as never;
  });
});

test('identity loads all team pages beyond the Appwrite default limit', async () => {
  const teamList = Array.from({ length: 101 }, (_, index) => ({
    $id: `team-${index}`,
    name: `Team ${index}`,
  }));
  jest
    .mocked(teams.list)
    .mockResolvedValueOnce({ total: 101, teams: teamList.slice(0, 100) } as never)
    .mockResolvedValueOnce({ total: 101, teams: teamList.slice(100) } as never);
  const me = await getCurrentIdentity();
  expect(me.memberships).toHaveLength(101);
  expect(teams.list).toHaveBeenCalledTimes(2);
});

test('pending invitations do not become authorized workspaces', async () => {
  jest
    .mocked(teams.list)
    .mockResolvedValue({ total: 1, teams: [{ $id: 'team-1', name: 'Team' }] } as never);
  jest.mocked(teams.listMemberships).mockResolvedValue({
    total: 1,
    memberships: [{ userId: 'user-1', teamId: 'team-1', confirm: false, roles: ['owner'] }],
  } as never);
  expect((await getCurrentIdentity()).memberships).toEqual([]);
});

test('custom roles do not acquire administrator permissions', async () => {
  jest
    .mocked(teams.list)
    .mockResolvedValue({ total: 1, teams: [{ $id: 'team-1', name: 'Team' }] } as never);
  jest.mocked(teams.listMemberships).mockResolvedValue({
    total: 1,
    memberships: [{ userId: 'user-1', teamId: 'team-1', confirm: true, roles: ['viewer'] }],
  } as never);
  expect((await getCurrentIdentity()).memberships[0].permissions).not.toContain('admin.manage');
});

test('concurrent bootstrap reads create a single default team', async () => {
  jest
    .mocked(teams.list)
    .mockResolvedValueOnce({ total: 0, teams: [] } as never)
    .mockResolvedValueOnce({ total: 1, teams: [{ $id: 'team-1', name: 'Team' }] } as never);
  await Promise.all([getCurrentIdentity(), getCurrentIdentity()]);
  expect(teams.create).toHaveBeenCalledTimes(1);
});
