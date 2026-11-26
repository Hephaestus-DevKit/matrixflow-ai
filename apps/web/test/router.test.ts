import { Query } from 'appwrite';
import { routeBackend } from '../src/lib/backend/router';
import { executeCore, getRow, listRows, listRowsPage } from '../src/lib/backend/data';

jest.mock('../src/lib/backend/data', () => ({
  listRowsPage: jest.fn(),
  listRows: jest.fn(),
  executeCore: jest.fn(),
  getRow: jest.fn(),
}));

test('a content project link resolves to the specific project', async () => {
  const project = { id: 'project-1', name: 'Travel bag' };
  jest.mocked(getRow).mockResolvedValue(project);
  await expect(routeBackend('GET', '/content/projects/project-1')).resolves.toEqual(project);
  expect(getRow).toHaveBeenCalledWith('content_projects', project.id);
});

test('knowledge base options load without querying knowledge documents', async () => {
  const options = {
    data: [{ id: 'kb-1', name: 'Product handbook' }],
    total: 25,
    limit: 10,
    offset: 10,
    nextOffset: 20,
  };
  jest.mocked(listRowsPage).mockResolvedValue(options);
  await expect(routeBackend('GET', '/kb?view=options&limit=10&offset=10')).resolves.toEqual(
    options,
  );
  expect(listRowsPage).toHaveBeenLastCalledWith(
    'knowledge_bases',
    [Query.select(['$id', 'name'])],
    'organizationId',
    { limit: 10, offset: 10 },
  );
  expect(listRows).not.toHaveBeenCalled();
});

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
