import { Controller, Post, UploadedFile, UseInterceptors, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { unlinkSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { MinioService } from './minio.service';
import { RbacGuard } from '../auth/rbac.guard';
import { Permissions } from '../auth/rbac.decorator';

const uploadDir = join(process.cwd(), '.tmp', 'uploads');
mkdirSync(uploadDir, { recursive: true });

@Controller('files')
@UseGuards(RbacGuard)
export class FilesController {
  constructor(private readonly minioService: MinioService) {}

  @Post('upload')
  @Permissions('employee:create')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, callback) => {
          const suffix = extname(file.originalname || '').toLowerCase();
          callback(null, `${randomUUID()}${suffix}`);
        },
      }),
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    const key = `uploads/${file.filename}`;
    const result = await this.minioService.uploadFile({
      key,
      filePath: file.path,
      contentType: file.mimetype,
    });

    unlinkSync(file.path);
    return result;
  }
}