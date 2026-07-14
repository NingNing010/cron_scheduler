import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { CronExpressionParser } from 'cron-parser';
import { DYNAMIC_CRON_QUEUE } from './dynamic-cron.constants';
import { DynamicCronJobData } from './cron-job.types';

@Processor(DYNAMIC_CRON_QUEUE)
@Injectable()
export class CronWorker extends WorkerHost {
  constructor(
    @InjectQueue(DYNAMIC_CRON_QUEUE)
    private readonly cronQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<DynamicCronJobData>): Promise<void> {
    const { jobName, cronExpression } = job.data;
    const now = new Date();

    console.log(`[CronWorker] jobName=${jobName} executed at ${now.toISOString()}`);

    const interval = CronExpressionParser.parse(cronExpression);
    const nextRun = interval.next().toDate();
    const delayTime = Math.max(nextRun.getTime() - Date.now(), 0);

    await this.cronQueue.add(
      jobName,
      {
        jobName,
        cronExpression,
        nextRun: nextRun.toISOString(),
      },
      {
        delay: delayTime,
      },
    );
  }
}
