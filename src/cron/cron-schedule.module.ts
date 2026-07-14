import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CronScheduleController } from './cron-schedule.controller';
import { CronScheduleService } from './cron-schedule.service';
import { CronWorker } from './cron-worker';
import { DYNAMIC_CRON_QUEUE } from './dynamic-cron.constants';

@Module({
  imports: [
    BullModule.registerQueue({
      name: DYNAMIC_CRON_QUEUE,
    }),
  ],
  controllers: [CronScheduleController],
  providers: [CronScheduleService, CronWorker],
  exports: [CronScheduleService],
})
export class CronScheduleModule {}
