import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { CronValidationModule } from './cron/cron-validation.module';
import { CronScheduleModule } from './cron/cron-schedule.module';
import { PrismaModule } from './prisma/prisma.module';
import { TaskModule } from './task/task.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
    PrismaModule,
    CronValidationModule,
    CronScheduleModule,
    TaskModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
