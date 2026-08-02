import { Body, Controller, Post, Query, UseGuards } from '@nestjs/common';
import { Permissions } from '../auth/rbac.decorator';
import { RbacGuard } from '../auth/rbac.guard';
import { SyncScheduleDto } from './sync-schedule.dto';
import { SyncScheduleService } from './sync-schedule.service';
import { SyncService } from './sync.service';

@Controller('sync')
@UseGuards(RbacGuard)
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    private readonly syncScheduleService: SyncScheduleService,
  ) {}

  @Post('run')
  @Permissions('sync:run')
  run(@Query('batchSize') batchSize?: string) {
    return this.syncService.syncEmployees(batchSize ? Number(batchSize) : 1000);
  }

  @Post('schedule')
  @Permissions('sync:schedule')
  schedule(@Body() dto: SyncScheduleDto) {
    return this.syncScheduleService.schedule(dto);
  }

}