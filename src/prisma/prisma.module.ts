import { Global, Module } from '@nestjs/common';
import { MariaDbPrismaService } from './mariadb-prisma.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, MariaDbPrismaService],
  exports: [PrismaService, MariaDbPrismaService],
})
export class PrismaModule {}
