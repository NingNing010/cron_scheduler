import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthController } from './health.controller';
import { MariaDbHealthIndicator } from './mariadb.health.indicator';
import { PostgresHealthIndicator } from './postgres.health.indicator';

@Module({
  imports: [TerminusModule, PrismaModule],
  controllers: [HealthController],
  providers: [PostgresHealthIndicator, MariaDbHealthIndicator],
})
export class HealthModule {}