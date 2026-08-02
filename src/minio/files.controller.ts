import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { unlinkSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { MinioService } from './minio.service';

const uploadDir = join(process.cwd(), '.tmp', 'uploads');
mkdirSync(uploadDir, { recursive: true });

@Controller('files')
export class FilesController {
  constructor(private readonly minioService: MinioService) {}

  @Post('upload')
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