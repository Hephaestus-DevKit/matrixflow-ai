import { createInternalClient } from '../src/internal-client';

describe('internal worker client', () => {
  it('sends the internal secret and JSON body', async () => {
    const fetchImpl = jest.fn(async () => new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }));
    const call = createInternalClient({ baseUrl: 'http://api/api/v1/', secret: 'secret', timeoutMs: 1_000, fetchImpl: fetchImpl as any });
    await expect(call('/jobs', { id: 1 })).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith('http://api/api/v1/jobs', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'x-internal-job-secret': 'secret' }),
      body: '{"id":1}',
    }));
  });

  it('throws on a non-success response', async () => {
    const fetchImpl = jest.fn(async () => new Response('failed', { status: 500 }));
    const call = createInternalClient({ baseUrl: 'http://api', secret: 'secret', timeoutMs: 1_000, fetchImpl: fetchImpl as any });
    await expect(call('/jobs')).rejects.toThrow('Internal job endpoint failed (500)');
  });
});
