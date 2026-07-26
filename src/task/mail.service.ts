import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      pool: true,             // 1. BẬT CHẾ ĐỘ POOLING (Giữ kết nối sống)
      maxConnections: 1,      // 2. Chỉ dùng 1 kết nối duy nhất để tránh bị Gmail đánh dấu spam
      rateDelta: 10000,       // 3. Khối thời gian: 10 giây
      rateLimit: 5,           // 4. Giới hạn tối đa gửi 5 mail / 10 giây qua đường ống này
      auth: {
        user: process.env.MAIL_USER || 'default_email@gmail.com',
        pass: process.env.MAIL_PASS || '',
      },
    });
  }

  async sendCronEmail(to: string, subject: string, content: string): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: '"Hệ Thống Lập Lịch Cron" <no-reply@cronsystem.com>',
        to: to,
        subject: `[CRON JOB] ${subject}`,
        html: `<h3>Thông báo từ hệ thống tự động</h3><p>${content}</p><hr><small>Email này được gửi tự động bởi NestJS Cron Scheduler.</small>`,
      });
      this.logger.log(`Email đã gửi thành công tới: ${to}`);
      return true;
    } catch (error) {
      // Đã fix lỗi Type safety ở đây:
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Lỗi gửi mail: ${errorMessage}`);
      throw error;
    }
  }
}