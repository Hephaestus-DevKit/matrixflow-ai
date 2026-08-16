import test from 'node:test';
import assert from 'node:assert/strict';
import { Permission, Role } from 'node-appwrite';
import { validateKnowledgeFile } from '../src/knowledge-files.js';

function servicesFor(file) {
  return { storage: { getFile: async () => file } };
}

test('knowledge documents use authoritative Storage metadata scoped to the current team', async () => {
  const result = await validateKnowledgeFile(
    servicesFor({
      $id: 'file-1',
      name: 'manual.pdf',
      mimeType: 'application/pdf',
      sizeOriginal: 2048,
      $permissions: [Permission.read(Role.team('team-1'))],
    }),
    'team-1',
    { fileId: 'file-1', title: 'Product manual', mimeType: 'text/plain', size: 1 },
  );
  assert.deepEqual(result, {
    fileId: 'file-1',
    title: 'Product manual',
    mimeType: 'application/pdf',
    size: 2048,
  });
});

test('knowledge documents reject cross-team or broadly readable uploads', async () => {
  await assert.rejects(
    () =>
      validateKnowledgeFile(
        servicesFor({
          $id: 'file-1',
          mimeType: 'application/pdf',
          sizeOriginal: 2048,
          $permissions: [Permission.read(Role.team('team-2'))],
        }),
        'team-1',
        { fileId: 'file-1', title: 'Manual', mimeType: 'application/pdf', size: 2048 },
      ),
    (error) => error.code === 'FILE_FORBIDDEN',
  );
  await assert.rejects(
    () =>
      validateKnowledgeFile(
        servicesFor({
          $id: 'file-1',
          mimeType: 'application/pdf',
          sizeOriginal: 2048,
          $permissions: [Permission.read(Role.team('team-1')), Permission.read(Role.any())],
        }),
        'team-1',
        { fileId: 'file-1', title: 'Manual', mimeType: 'application/pdf', size: 2048 },
      ),
    (error) => error.code === 'FILE_FORBIDDEN',
  );
});
