import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DynamicCronQueueModule } from '../queue/dynamic-cron-queue.module';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

@Module({
  imports: [PrismaModule, DynamicCronQueueModule],
  controllers: [TaskController],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
