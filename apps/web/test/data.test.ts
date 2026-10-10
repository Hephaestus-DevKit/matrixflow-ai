import { File as NodeFile } from 'node:buffer';
import { appwriteFunctions, storage, tablesDB } from '../src/lib/appwrite';
import { getRow, uploadKnowledgeFile } from '../src/lib/backend/data';
import { setOrganizationContext } from '../src/lib/backend/organization-context';

jest.mock('../src/lib/appwrite', () => ({
  appwriteFunctions: { createExecution: jest.fn() },
  storage: { createFile: jest.fn(), deleteFile: jest.fn() },
  tablesDB: { getRow: jest.fn() },
}));

beforeEach(() => {
  jest.resetAllMocks();
  Object.defineProperty(globalThis, 'File', { value: NodeFile, configurable: true });
  setOrganizationContext('team-1');
  jest
    .mocked(tablesDB.getRow)
    .mockResolvedValue({ $id: 'base-1', organizationId: 'team-1' } as never);
  jest.mocked(storage.createFile).mockResolvedValue({ $id: 'file-1' } as never);
  jest.mocked(appwriteFunctions.createExecution).mockResolvedValue({
    responseStatusCode: 200,
    responseBody: '{"data":{"id":"document-1"}}',
  } as never);
});

function uploadForm() {
  const form = new FormData();
  form.append(
    'file',
    new NodeFile(['knowledge'], 'notes.txt', { type: 'text/plain' }) as unknown as File,
  );
  return form;
}

test('an upload remains in its original team when the user switches during Storage upload', async () => {
  let resolve!: (value: never) => void;
  let started!: () => void;
  const uploading = new Promise<void>((done) => {
    started = done;
  });
  jest.mocked(storage.createFile).mockImplementation(() => {
    started();
    return new Promise((done) => {
      resolve = done;
    });
  });
  const pending = uploadKnowledgeFile('base-1', uploadForm());
  await uploading;
  setOrganizationContext('team-2');
  resolve({ $id: 'file-1' } as never);
  await pending;
  const executions = jest.mocked(appwriteFunctions.createExecution).mock.calls;
  expect(executions).toHaveLength(2);
  for (const [input] of executions)
    expect(JSON.parse((input as unknown as { body: string }).body).organizationId).toBe('team-1');
});

test('a failed document response preserves the file for an idempotent retry', async () => {
  jest.mocked(appwriteFunctions.createExecution).mockRejectedValue({ code: 502 });
  await expect(uploadKnowledgeFile('base-1', uploadForm())).rejects.toMatchObject({ status: 502 });
  expect(storage.deleteFile).not.toHaveBeenCalled();
});

test('a read completing after a team switch cannot populate the new team cache', async () => {
  let resolve!: (value: never) => void;
  jest.mocked(tablesDB.getRow).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const pending = getRow('agents', 'agent-1');
  setOrganizationContext('team-2');
  resolve({ $id: 'agent-1', organizationId: 'team-1' } as never);
  await expect(pending).rejects.toMatchObject({ code: 'ORGANIZATION_CHANGED' });
});
