import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectionOptions, Job, JobsOptions, Queue } from 'bullmq';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly documents: Queue;
  private readonly workflows: Queue;
  private readonly jobOptions: JobsOptions;

  constructor(redis: RedisService, config: ConfigService) {
    const connection = redis.raw() as unknown as ConnectionOptions;
    this.documents = new Queue('document-processing', { connection });
    this.workflows = new Queue('workflow-execution', { connection });
    this.jobOptions = {
      attempts: Math.max(1, config.get<number>('QUEUE_MAX_RETRIES', 5)),
      backoff: { type: config.get<string>('QUEUE_BACKOFF_TYPE', 'exponential'), delay: 1_000 },
      removeOnComplete: { age: 86_400, count: 1_000 },
      removeOnFail: { age: 604_800, count: 5_000 },
    };
  }

  enqueueDocument(docId: string): Promise<Job> {
    return this.documents.add(
      'process',
      { docId },
      { ...this.jobOptions, jobId: `document-${docId}` },
    );
  }

  enqueueWorkflow(runId: string, userId: string): Promise<Job> {
    return this.workflows.add(
      'execute',
      { runId, userId },
      { ...this.jobOptions, jobId: `workflow-${runId}` },
    );
  }

  async onModuleDestroy() {
    await Promise.all([this.documents.close(), this.workflows.close()]);
  }
}
