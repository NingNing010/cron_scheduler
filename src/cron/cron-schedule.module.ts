import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CronScheduleController } from './cron-schedule.controller';
import { CronScheduleService } from './cron-schedule.service';
import { CronWorker } from './cron-worker';
import { DYNAMIC_CRON_QUEUE } from './dynamic-cron.constants';
import { TaskModule } from '../task/task.module';     // 1. Import thêm TaskModule
import { PrismaModule } from '../prisma/prisma.module'; // 2. Import thêm PrismaModule

@Module({
  imports: [
    BullModule.registerQueue({
      name: DYNAMIC_CRON_QUEUE,
    }),
    TaskModule,   // 3. Thêm TaskModule vào đây (để dùng được MailService)
    PrismaModule, // 4. Thêm PrismaModule vào đây (để dùng được PrismaService)
  ],
  controllers: [CronScheduleController],
  providers: [CronScheduleService, CronWorker],
  exports: [CronScheduleService],
})
export class CronScheduleModule {}