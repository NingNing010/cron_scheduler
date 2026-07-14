import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CronValidationModule } from './cron/cron-validation.module';
import { CronScheduleModule } from './cron/cron-schedule.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
    CronValidationModule,
    CronScheduleModule,
  ],
})
export class AppModule {}
