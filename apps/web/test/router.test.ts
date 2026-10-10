import { routeBackend } from '../src/lib/backend/router';
import { executeCore, listRowsPage } from '../src/lib/backend/data';

jest.mock('../src/lib/backend/data', () => ({ listRowsPage: jest.fn(), executeCore: jest.fn() }));

test.each([
  ['/crm/customers', 50, 0],
  ['/crm/leads?offset=100', 50, 100],
  ['/jobs?offset=25', 25, 25],
  ['/crm/customers?limit=', 50, 0],
  ['/crm/customers?limit=invalid', 50, 0],
  ['/crm/customers?limit=1000', 100, 0],
  ['/crm/customers?limit=0', 1, 0],
])('pagination defaults and bounds for %s', async (path, limit, offset) => {
  if (path.startsWith('/jobs')) {
    await routeBackend('GET', path);
    expect(executeCore).toHaveBeenLastCalledWith('/jobs', { limit, offset }, 'GET');
    return;
  }
  jest
    .mocked(listRowsPage)
    .mockResolvedValue({ data: [], total: 0, limit, offset, nextOffset: null });
  await routeBackend('GET', path);
  expect(listRowsPage).toHaveBeenLastCalledWith(expect.any(String), [], 'organizationId', {
    limit,
    offset,
  });
});
