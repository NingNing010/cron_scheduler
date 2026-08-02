import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream } from 'fs';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly bucketName = process.env.MINIO_BUCKET ?? 'cron-demo';
  private readonly client = new S3Client({
    region: process.env.MINIO_REGION ?? 'us-east-1',
    endpoint: process.env.MINIO_ENDPOINT ?? 'http://localhost:9000',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
      secretAccessKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
    },
  });

  async onModuleInit() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
      this.logger.log(`Created MinIO bucket: ${this.bucketName}`);
    }
  }

  async uploadFile(params: { key: string; filePath: string; contentType?: string }) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: params.key,
        Body: createReadStream(params.filePath),
        ContentType: params.contentType,
      }),
    );

    return {
      bucket: this.bucketName,
      key: params.key,
      url: await this.getSignedDownloadUrl(params.key),
    };
  }

  async getSignedDownloadUrl(key: string, expiresIn = 3600) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucketName, Key: key }),
      { expiresIn },
    );
  }

  async deleteFile(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }));
  }
}