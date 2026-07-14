import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
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
    const interval = CronExpressionParser.parse(cronExpression);
    const nextRun = interval.next().toDate();
    const delayTime = Math.max(nextRun.getTime() - Date.now(), 0);

    await this.cronQueue.add(
      dto.jobName,
      {
        jobName: dto.jobName,
        cronExpression,
        nextRun: nextRun.toISOString(),
      },
      {
        delay: delayTime,
      },
    );

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
