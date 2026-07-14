import { Module } from '@nestjs/common';
import { CronValidationController } from './cron-validation.controller';
import { CronValidationService } from './cron-validation.service';

@Module({
  controllers: [CronValidationController],
  providers: [CronValidationService],
  exports: [CronValidationService],
})
export class CronValidationModule {}
