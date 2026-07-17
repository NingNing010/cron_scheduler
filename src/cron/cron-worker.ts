import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { CronExpressionParser } from 'cron-parser';
import { DYNAMIC_CRON_QUEUE } from './dynamic-cron.constants';
import { DynamicCronJobData } from './cron-job.types';
import { PrismaService } from '../prisma/prisma.service';

const buildTaskJobId = (taskId: number) => `task-${taskId}`;

@Processor(DYNAMIC_CRON_QUEUE)
@Injectable()
export class CronWorker extends WorkerHost {
  constructor(
    @InjectQueue(DYNAMIC_CRON_QUEUE)
    private readonly cronQueue: Queue,
    private readonly prismaService: PrismaService,
  ) {
    super();
  }

  async process(job: Job<DynamicCronJobData>): Promise<void> {
    const { taskId, jobName, cronExpression } = job.data;
    const now = new Date();

    console.log(`[CronWorker] jobName=${jobName} executed at ${now.toISOString()}`);

    const interval = CronExpressionParser.parse(cronExpression);
    const nextRun = interval.next().toDate();
    const delayTime = Math.max(nextRun.getTime() - Date.now(), 0);

    if (taskId) {
      const activeTask = await this.prismaService.task.findFirst({
        where: { id: taskId, status: 'ACTIVE' },
      });

      if (!activeTask) {
        return;
      }

      // Mỗi lần chạy xong, DB được cập nhật để frontend luôn thấy nextRun mới nhất.
      await this.prismaService.task.update({
        where: { id: taskId },
        data: { nextRun },
      });
    }

    // Gỡ job hiện tại trước khi tạo job mới để tránh trùng jobId khi tái nạp chu kỳ tiếp theo.
    await job.remove();

    await this.cronQueue.add(
      jobName,
      {
        taskId,
        jobName,
        cronExpression,
        nextRun: nextRun.toISOString(),
      },
      {
        delay: delayTime,
        jobId: taskId ? buildTaskJobId(taskId) : undefined,
        removeOnComplete: true,
      },
    );
  }
}
