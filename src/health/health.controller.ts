import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { MariaDbHealthIndicator } from './mariadb.health.indicator';
import { PostgresHealthIndicator } from './postgres.health.indicator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly postgresHealthIndicator: PostgresHealthIndicator,
    private readonly mariaDbHealthIndicator: MariaDbHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.healthCheckService.check([
      () => this.postgresHealthIndicator.isHealthy(),
      () => this.mariaDbHealthIndicator.isHealthy(),
    ]);
  }
}