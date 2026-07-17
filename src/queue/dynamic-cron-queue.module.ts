import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DYNAMIC_CRON_QUEUE } from '../cron/dynamic-cron.constants';

@Module({
  imports: [
    BullModule.registerQueue({
      name: DYNAMIC_CRON_QUEUE,
    }),
  ],
  exports: [BullModule],
})
export class DynamicCronQueueModule {}
