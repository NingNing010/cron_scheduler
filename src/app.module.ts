import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { EmployeeModule } from './employee/employee.module';
import { CronValidationModule } from './cron/cron-validation.module';
import { CronScheduleModule } from './cron/cron-schedule.module';
import { HealthModule } from './health/health.module';
import { MinioModule } from './minio/minio.module';
import { PrismaModule } from './prisma/prisma.module';
import { TaskModule } from './task/task.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
    PrismaModule,
    AuthModule,
    CronValidationModule,
    CronScheduleModule,
    TaskModule,
    HealthModule,
    MinioModule,
    EmployeeModule,
    SyncModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
