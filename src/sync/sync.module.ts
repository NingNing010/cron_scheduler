import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DynamicCronQueueModule } from '../queue/dynamic-cron-queue.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SyncController } from './sync.controller';
import { SyncScheduleService } from './sync-schedule.service';
import { SyncService } from './sync.service';

@Module({
  imports: [DynamicCronQueueModule, PrismaModule, AuthModule],
  controllers: [SyncController],
  providers: [SyncService, SyncScheduleService],
  exports: [SyncService, SyncScheduleService],
})
export class SyncModule {}