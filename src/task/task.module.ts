import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DynamicCronQueueModule } from '../queue/dynamic-cron-queue.module';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { MailService } from './mail.service'; // Đảm bảo đã import

@Module({
  imports: [PrismaModule, DynamicCronQueueModule],
  controllers: [TaskController],
  providers: [TaskService, MailService],
  exports: [TaskService, MailService],
})
export class TaskModule {}
