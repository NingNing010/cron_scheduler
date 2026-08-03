import { Controller, Get, UseGuards } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { MariaDbHealthIndicator } from './mariadb.health.indicator';
import { PostgresHealthIndicator } from './postgres.health.indicator';
import { Roles } from '../auth/rbac.decorator';
import { RbacGuard } from '../auth/rbac.guard';

@Controller('health')
@UseGuards(RbacGuard)
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly postgresHealthIndicator: PostgresHealthIndicator,
    private readonly mariaDbHealthIndicator: MariaDbHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @Roles('admin')
  check() {
    return this.healthCheckService.check([
      () => this.postgresHealthIndicator.isHealthy(),
      () => this.mariaDbHealthIndicator.isHealthy(),
    ]);
  }
}