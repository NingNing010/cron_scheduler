import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { CronExpressionParser } from 'cron-parser';
import { DYNAMIC_CRON_QUEUE } from '../cron/dynamic-cron.constants';
import { SyncScheduleDto } from './sync-schedule.dto';

type SyncScheduleResponse = {
  success: true;
  message: string;
  jobName: string;
  cronExpression: string;
  nextRun: Date;
  delay: number;
};

const buildSyncJobId = (jobName: string, nextRun: Date) => `sync-${jobName}-${nextRun.getTime()}`;

@Injectable()
export class SyncScheduleService {
  constructor(
    @InjectQueue(DYNAMIC_CRON_QUEUE)
    private readonly cronQueue: Queue,
  ) {}

  async schedule(dto: SyncScheduleDto): Promise<SyncScheduleResponse> {
    let nextRun: Date;

    try {
      const interval = CronExpressionParser.parse(dto.cronExpression);
      nextRun = interval.next().toDate();
    } catch {
      throw new BadRequestException('Invalid cron expression');
    }

    const delayTime = Math.max(nextRun.getTime() - Date.now(), 0);

    await this.cronQueue.add(
      dto.jobName,
      {
        jobType: 'sync',
        jobName: dto.jobName,
          cronExpression: dto.cronExpression,
        nextRun: nextRun.toISOString(),
          syncBatchSize: dto.batchSize,
      },
      {
        delay: delayTime,
        jobId: buildSyncJobId(dto.jobName, nextRun),
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    return {
      success: true,
      message: 'Đặt lịch sync thành công',
      jobName: dto.jobName,
      cronExpression: dto.cronExpression,
      nextRun,
      delay: delayTime,
    };
  }
}