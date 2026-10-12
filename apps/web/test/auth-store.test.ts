import { useAuth } from '../src/lib/auth-store';
import { getCurrentIdentity, updateCurrentProfile } from '../src/lib/backend/session';

jest.mock('../src/lib/backend/session', () => ({
  getCurrentIdentity: jest.fn(),
  invalidateIdentityRequest: jest.fn(),
  updateCurrentProfile: jest.fn(),
}));
jest.mock('../src/lib/api-client', () => ({
  clearAppwriteCache: jest.fn(),
  clearOrganizationContext: jest.fn(),
}));
jest.mock('../src/lib/backend/organization-context', () => ({ setOrganizationContext: jest.fn() }));
jest.mock('../src/lib/appwrite', () => ({
  account: { deleteSession: jest.fn().mockResolvedValue({}) },
}));

const me = {
  id: 'user-1',
  name: 'User',
  email: 'user@example.com',
  memberships: [
    {
      organizationId: 'team-1',
      organizationName: 'Team',
      slug: 'team',
      role: 'owner',
      permissions: [],
    },
  ],
};

beforeEach(() => {
  useAuth.setState({ user: null, organizationId: null });
  jest.clearAllMocks();
});

test('an identity response arriving after logout cannot restore the session', async () => {
  let resolve!: (value: typeof me) => void;
  jest.mocked(getCurrentIdentity).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const pending = useAuth.getState().fetchMe();
  const rejected = expect(pending).rejects.toThrow('AUTH_REQUEST_SUPERSEDED');
  await useAuth.getState().logout();
  resolve(me);
  await rejected;
  expect(useAuth.getState().user).toBeNull();
  expect(useAuth.getState().organizationId).toBeNull();
});

test('a failed older identity read cannot erase a newer successful read', async () => {
  let reject!: (reason: Error) => void;
  jest
    .mocked(getCurrentIdentity)
    .mockReturnValueOnce(
      new Promise((_done, fail) => {
        reject = fail;
      }),
    )
    .mockResolvedValueOnce(me);
  const pending = useAuth.getState().fetchMe();
  const rejected = expect(pending).rejects.toThrow('offline');
  await useAuth.getState().fetchMe();
  reject(new Error('offline'));
  await rejected;
  expect(useAuth.getState().user?.id).toBe('user-1');
});

test('a profile response after logout cannot restore the user', async () => {
  let resolve!: (value: typeof me) => void;
  jest.mocked(updateCurrentProfile).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const pending = useAuth.getState().updateProfile('User', '');
  const rejected = expect(pending).rejects.toThrow('AUTH_REQUEST_SUPERSEDED');
  await useAuth.getState().logout();
  resolve(me);
  await rejected;
  expect(useAuth.getState().user).toBeNull();
});
