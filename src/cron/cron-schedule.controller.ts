import { Body, Controller, Post } from '@nestjs/common';
import { CronScheduleDto } from './cron-schedule.dto';
import { CronScheduleService } from './cron-schedule.service';

@Controller('cron')
export class CronScheduleController {
  constructor(private readonly cronScheduleService: CronScheduleService) {}

  @Post('schedule')
  schedule(@Body() dto: CronScheduleDto) {
    return this.cronScheduleService.schedule(dto);
  }
}
