import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MinioModule } from '../minio/minio.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { EmployeeCodeUniqueConstraint } from './validators/employee-code-unique.validator';

@Module({
  imports: [PrismaModule, MinioModule, AuthModule],
  controllers: [EmployeeController],
  providers: [EmployeeService, EmployeeCodeUniqueConstraint],
  exports: [EmployeeService],
})
export class EmployeeModule {}