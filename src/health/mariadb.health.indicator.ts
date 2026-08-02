import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { MariaDbPrismaService } from '../prisma/mariadb-prisma.service';

@Injectable()
export class MariaDbHealthIndicator extends HealthIndicator {
  constructor(private readonly mariaDbPrismaService: MariaDbPrismaService) {
    super();
  }

  async isHealthy(key = 'mariadb'): Promise<HealthIndicatorResult> {
    try {
      await this.mariaDbPrismaService.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'MariaDB unavailable';
      throw new HealthCheckError('MariaDB check failed', this.getStatus(key, false, { message }));
    }
  }
}