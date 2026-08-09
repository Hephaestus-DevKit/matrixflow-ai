import { BadRequestException } from '@nestjs/common';
import { WorkflowExecutor } from '../src/workflow/workflow.executor';

describe('WorkflowExecutor', () => {
  const ai = { runPrompt: jest.fn(async () => ({ content: 'ok' })) };
  const emailDelivery = {
    send: jest.fn(async () => ({ provider: 'test', messageId: 'message-1' })),
  };
  const executor = new WorkflowExecutor(ai as any, emailDelivery);
  const context = { organizationId: 'org', userId: 'user', workflowId: 'workflow', runId: 'run' };

  beforeEach(() => jest.clearAllMocks());

  it('evaluates conditions deterministically', async () => {
    const output = await executor.execute(
      {
        nodes: [
          { id: 'trigger', type: 'trigger', config: {} },
          {
            id: 'condition',
            type: 'condition',
            config: { field: 'score', operator: 'gte', value: 10 },
          },
        ],
        edges: [{ source: 'trigger', target: 'condition' }],
      },
      { score: 12 },
      context,
    );
    expect(output).toBe(true);
  });

  it('normalizes numeric condition values from the visual editor', async () => {
    await expect(
      executor.execute(
        {
          nodes: [
            { id: 'trigger', type: 'trigger' },
            {
              id: 'condition',
              type: 'condition',
              config: { field: 'score', operator: 'eq', value: '10' },
            },
          ],
          edges: [{ source: 'trigger', target: 'condition' }],
        },
        { score: 10 },
        context,
      ),
    ).resolves.toBe(true);
  });

  it('calls the configured AI prompt instead of returning a stub', async () => {
    await executor.execute(
      {
        nodes: [{ id: 'ai', type: 'ai', config: { promptKey: 'summary' } }],
        edges: [],
      },
      { text: 'hello' },
      context,
    );
    expect(ai.runPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ promptKey: 'summary', organizationId: 'org' }),
    );
  });

  it('delegates email delivery through the configured port', async () => {
    await expect(
      executor.execute(
        {
          nodes: [
            { id: 'trigger', type: 'trigger' },
            {
              id: 'email',
              type: 'email',
              config: { to: 'owner@example.com', subject: 'Result', body: 'Output: {{input}}' },
            },
          ],
          edges: [{ source: 'trigger', target: 'email' }],
        },
        { score: 10 },
        context,
      ),
    ).resolves.toEqual({ provider: 'test', messageId: 'message-1' });
    expect(emailDelivery.send).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org',
        to: 'owner@example.com',
        body: 'Output: {"score":10}',
      }),
    );
  });

  it('rejects cyclic workflows', async () => {
    await expect(
      executor.execute(
        {
          nodes: [
            { id: 'a', type: 'trigger' },
            { id: 'b', type: 'transform', config: { template: 'x' } },
          ],
          edges: [
            { source: 'a', target: 'b' },
            { source: 'b', target: 'a' },
          ],
        },
        {},
        context,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks private webhook destinations', async () => {
    await expect(
      executor.execute(
        {
          nodes: [{ id: 'webhook', type: 'webhook', config: { url: 'http://127.0.0.1/internal' } }],
          edges: [],
        },
        {},
        context,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
