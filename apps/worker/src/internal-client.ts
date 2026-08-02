export function createInternalClient(options: {
  baseUrl: string;
  secret: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}) {
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!options.secret) throw new Error('INTERNAL_JOB_SECRET is required');

  return async (path: string, body?: unknown) => {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-job-secret': options.secret,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    if (!response.ok) {
      const message = (await response.text()).slice(0, 1_000);
      throw new Error(`Internal job endpoint failed (${response.status}): ${message}`);
    }
    return response.json();
  };
}
