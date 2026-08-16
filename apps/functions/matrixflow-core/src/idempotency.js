import {
  deleteIdempotency,
  findIdempotency,
  HttpError,
  saveIdempotency,
  TABLES,
  updateOwned,
} from './runtime.js';

const IN_PROGRESS_STATUS = 102;
const CLAIM_TTL_MS = 5 * 60_000;
const REPLAY_TTL_MS = 24 * 60 * 60_000;
const MAX_REPLAY_BYTES = 50_000;

export async function claimIdempotency(services, teamId, { key, fingerprint, method, path }) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const previous = await findIdempotency(services, teamId, key);
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw new HttpError('幂等键已用于其他请求', 409, 'IDEMPOTENCY_CONFLICT');
      const expiresAt = new Date(previous.expiresAt).getTime();
      if (expiresAt > Date.now()) {
        if (Number(previous.status) === IN_PROGRESS_STATUS || !previous.response)
          throw new HttpError('相同请求仍在处理中，请稍后重试', 409, 'IDEMPOTENCY_IN_PROGRESS');
        let replay;
        try {
          replay = JSON.parse(previous.response);
        } catch {
          replay = null;
        }
        if (replay) return { replay, status: previous.status || 200 };
        throw new HttpError('幂等响应无法恢复，请稍后重试', 409, 'IDEMPOTENCY_REPLAY_UNAVAILABLE');
      }
      await releaseIdempotency(services, teamId, previous.id, false);
    }
    try {
      const claim = await saveIdempotency(services, teamId, {
        key,
        fingerprint,
        method,
        path,
        status: IN_PROGRESS_STATUS,
        response: '',
        expiresAt: new Date(Date.now() + CLAIM_TTL_MS).toISOString(),
      });
      return { claim, replay: null };
    } catch (error) {
      if (Number(error?.status || error?.code) !== 409) throw error;
    }
  }
  throw new HttpError('相同请求仍在处理中，请稍后重试', 409, 'IDEMPOTENCY_IN_PROGRESS');
}

export async function completeIdempotency(services, teamId, claimId, response, status) {
  const serialized = JSON.stringify(response);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_REPLAY_BYTES) {
    await releaseIdempotency(services, teamId, claimId);
    return false;
  }
  await updateOwned(services, TABLES.idempotencyKeys, claimId, teamId, {
    status,
    response: serialized,
    expiresAt: new Date(Date.now() + REPLAY_TTL_MS).toISOString(),
  });
  return true;
}

export async function releaseIdempotency(services, teamId, claimId, ignoreMissing = true) {
  try {
    await deleteIdempotency(services, teamId, claimId);
  } catch (error) {
    if (ignoreMissing && Number(error?.status || error?.code) === 404) return false;
    throw error;
  }
  return true;
}
