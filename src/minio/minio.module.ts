import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { MinioService } from './minio.service';

@Module({
  controllers: [FilesController],
  providers: [MinioService],
  exports: [MinioService],
})
export class MinioModule {}