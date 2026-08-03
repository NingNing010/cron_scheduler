import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DynamicCronQueueModule } from '../queue/dynamic-cron-queue.module';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { MailService } from './mail.service'; // Đảm bảo đã import
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, DynamicCronQueueModule, AuthModule],
  controllers: [TaskController],
  providers: [TaskService, MailService],
  exports: [TaskService, MailService],
})
export class TaskModule {}
