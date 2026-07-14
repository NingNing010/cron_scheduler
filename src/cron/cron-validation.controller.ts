import { Body, Controller, Post } from '@nestjs/common';
import { CronValidationService } from './cron-validation.service';
import { ValidateCronDto } from './validate-cron.dto';

@Controller('cron')
export class CronValidationController {
  constructor(private readonly cronValidationService: CronValidationService) {}

  @Post('validate')
  validate(@Body() dto: ValidateCronDto) {
    return this.cronValidationService.validate(dto);
  }
}
