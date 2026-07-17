import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { CronExpressionParser } from 'cron-parser';
import { buildCronExpression } from './cron-expression.util';
import { DYNAMIC_CRON_QUEUE } from './dynamic-cron.constants';
import { CronScheduleDto } from './cron-schedule.dto';

export type ScheduleCronResponse = {
  success: true;
  message: string;
  jobName: string;
  cronExpression: string;
  nextRun: Date;
  delay: number;
};

@Injectable()
export class CronScheduleService {
  constructor(
    @InjectQueue(DYNAMIC_CRON_QUEUE)
    private readonly cronQueue: Queue,
  ) {}

  async schedule(dto: CronScheduleDto): Promise<ScheduleCronResponse> {
    const cronExpression = buildCronExpression(dto);
    let nextRun: Date;

    try {
      const interval = CronExpressionParser.parse(cronExpression);
      nextRun = interval.next().toDate();
    } catch (error) {
      throw new BadRequestException('Invalid cron expression');
    }

    const delayTime = Math.max(nextRun.getTime() - Date.now(), 0);

    try {
      await this.cronQueue.add(
        dto.jobName,
        {
          jobName: dto.jobName,
          cronExpression,
          nextRun: nextRun.toISOString(),
        },
        {
          delay: delayTime,
          removeOnComplete: true,
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to schedule job';
      throw new BadRequestException(message);
    }

    return {
      success: true,
      message: 'Đặt lịch thành công',
      jobName: dto.jobName,
      cronExpression,
      nextRun,
      delay: delayTime,
    };
  }
}
