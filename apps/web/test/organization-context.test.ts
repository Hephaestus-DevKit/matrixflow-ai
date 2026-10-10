import {
  clearOrganizationContext,
  getOrganizationContext,
  setOrganizationContext,
} from '../src/lib/backend/organization-context';

test('restricted storage does not block a verified workspace or restore a cleared workspace', () => {
  Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: {
      getItem: () => 'stale-team',
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    },
    configurable: true,
  });
  try {
    expect(() => setOrganizationContext('verified-team')).not.toThrow();
    expect(getOrganizationContext()).toBe('verified-team');
    clearOrganizationContext();
    expect(() => getOrganizationContext()).toThrow();
  } finally {
    Reflect.deleteProperty(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'sessionStorage');
  }
});
