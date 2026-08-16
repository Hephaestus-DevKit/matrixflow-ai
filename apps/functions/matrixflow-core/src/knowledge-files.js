import { Permission, Role } from 'node-appwrite';
import { BUCKET_ID, HttpError } from './runtime.js';

const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Resolve a browser upload to authoritative, tenant-scoped Storage metadata. */
export async function validateKnowledgeFile(services, teamId, input) {
  let file;
  try {
    file = await services.storage.getFile({ bucketId: BUCKET_ID, fileId: input.fileId });
  } catch (error) {
    const status = Number(error?.status || error?.code);
    if (status === 404) throw new HttpError('上传文件不存在', 404, 'FILE_NOT_FOUND');
    if (status === 401 || status === 403)
      throw new HttpError('无权使用该上传文件', 403, 'FILE_FORBIDDEN');
    throw error;
  }
  const expectedRead = Permission.read(Role.team(teamId));
  const permissions = Array.isArray(file.$permissions) ? file.$permissions : [];
  if (!permissions.includes(expectedRead) || permissions.some((value) => value !== expectedRead))
    throw new HttpError('上传文件不属于当前团队空间', 403, 'FILE_FORBIDDEN');
  const size = Number(file.sizeOriginal);
  if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_BYTES)
    throw new HttpError('上传文件大小不符合要求', 413, 'FILE_TOO_LARGE');
  const mimeType = String(file.mimeType || input.mimeType || 'application/octet-stream')
    .trim()
    .toLowerCase()
    .slice(0, 128);
  if (!mimeType) throw new HttpError('上传文件类型无效', 422, 'FILE_TYPE_INVALID');
  return {
    fileId: file.$id,
    title: String(input.title || file.name || 'Knowledge document')
      .trim()
      .slice(0, 255),
    mimeType,
    size,
  };
}

export async function deleteKnowledgeFile(services, fileId) {
  try {
    await services.storage.deleteFile({ bucketId: BUCKET_ID, fileId });
    return true;
  } catch (error) {
    if (Number(error?.status || error?.code) === 404) return false;
    throw error;
  }
}
