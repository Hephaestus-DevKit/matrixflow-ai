import { isActiveJob, jobResultText, type BackgroundJob } from '../src/lib/jobs';
import { dashboardDestination } from '../src/lib/navigation';

const job = { id: 'job', attempts: 1, maxAttempts: 3, status: 'SUCCEEDED' } as BackgroundJob;
test.each(['QUEUED', 'RUNNING', 'RETRY_WAIT'])('%s keeps polling', (status) => {
  expect(isActiveJob({ status: status as BackgroundJob['status'] })).toBe(true);
});
test('only completed tasks expose usable results', () => {
  expect(
    jobResultText({ ...job, type: 'agent.run', result: { output: { text: 'saved result' } } }),
  ).toBe('saved result');
  expect(
    jobResultText({
      ...job,
      type: 'agent.run',
      status: 'FAILED',
      result: { output: { text: 'partial' } },
    }),
  ).toBe('');
  expect(isActiveJob(job)).toBe(false);
});
test('partial content batches export completed outputs without internal errors', () => {
  const text = jobResultText({
    ...job,
    type: 'content.generate-all',
    result: {
      results: [
        { type: 'listing', status: 'fulfilled', value: { content: 'product facts' } },
        { type: 'faq', status: 'rejected', error: { message: 'internal provider detail' } },
      ],
    },
  });
  expect(text).toContain('product facts');
  expect(text).not.toContain('internal provider detail');
});
test.each(['https://evil.example', '//evil.example', '/dashboard-evil', '/dashboard\\evil', null])(
  'unsafe login return route %s falls back',
  (next) => {
    expect(dashboardDestination(next)).toBe('/dashboard');
  },
);
test('login returns to the requested protected resource', () => {
  expect(dashboardDestination('/dashboard/content?project=abc')).toBe(
    '/dashboard/content?project=abc',
  );
});
