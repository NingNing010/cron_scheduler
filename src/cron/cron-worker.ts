import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { CronExpressionParser } from 'cron-parser';
import { DYNAMIC_CRON_QUEUE } from './dynamic-cron.constants';
import { DynamicCronJobData } from './cron-job.types';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../task/mail.service';

const buildTaskJobId = (taskId: number) => `task-${taskId}`;

@Processor(DYNAMIC_CRON_QUEUE)
@Injectable()
export class CronWorker extends WorkerHost {
  private readonly logger = new Logger(CronWorker.name);

  constructor(
    @InjectQueue(DYNAMIC_CRON_QUEUE)
    private readonly cronQueue: Queue,
    private readonly prismaService: PrismaService,
    private readonly mailService: MailService,
  ) {
    super();
  }

  async process(job: Job<DynamicCronJobData>): Promise<void> {
    const { taskId, jobName, cronExpression } = job.data;
    const now = new Date();

    this.logger.log(`[CronWorker] Bắt đầu xử lý Job: ${jobName} (Task ID: ${taskId}) lúc ${now.toLocaleTimeString()}`);

    if (!taskId) return;
    const task = await this.prismaService.task.findFirst({
      where: { id: taskId, status: 'ACTIVE' },
    });

    if (!task) {
      this.logger.warn(`[CronWorker] Task ID ${taskId} không tồn tại hoặc đã bị tắt. Hủy thực thi.`);
      return;
    }

    // 1. GHI LOG DB: Bắt đầu gửi (SENDING)
    const logEntry = await this.prismaService.jobLog.create({
      data: {
        taskId: task.id,
        status: 'SENDING',
        message: `Đang kết nối SMTP Server để gửi email tới ${task.recipientEmail}...`,
      },
    });

    // 2. THỰC THI GỬI EMAIL (AN TOÀN HÓA KHÔNG GÂY ĐỨT CHUỖI CRON)
    try {
      await this.mailService.sendCronEmail(
        task.recipientEmail,
        task.subject,
        task.content,
      );

      await this.prismaService.jobLog.update({
        where: { id: logEntry.id },
        data: {
          status: 'COMPLETED',
          message: `Đã gửi mail thành công tới ${task.recipientEmail} vào lúc ${new Date().toLocaleTimeString()}`,
        },
      });

      this.logger.log(`[JOB SUCCESS] Task ID ${taskId} đã gửi mail xong.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
      
      await this.prismaService.jobLog.update({
        where: { id: logEntry.id },
        data: {
          status: 'FAILED',
          message: `Lỗi: ${errorMessage}`,
        },
      });

      this.logger.error(`[JOB FAILED] Task ID ${taskId} thất bại: ${errorMessage}`);
      
      // ⚠️ QUAN TRỌNG: ĐÃ XÓA LỆNH "throw error;" Ở ĐÂY!
      // Bỏ throw error để hệ thống chấp nhận lỗi gửi mail, ghi log đỏ,
      // nhưng VẪN TIẾP TỤC CHẠY xuống dưới để lập lịch cho chu kỳ tiếp theo!
    }

    // ----------------------------------------------------------------------------------
    // 3. TỰ ĐỘNG TÍNH TOÁN VÀ ĐẨY LẠI VÀO QUEUE (LUÔN CHẠY DÙ MAIL THÀNH CÔNG HAY LỖI)
    // ----------------------------------------------------------------------------------
    const interval = CronExpressionParser.parse(cronExpression);
    const nextRun = interval.next().toDate();
    const delayTime = Math.max(nextRun.getTime() - Date.now(), 0);

    await this.prismaService.task.update({
      where: { id: taskId },
      data: { nextRun },
    });

    await job.remove();

    // ⚠️ QUAN TRỌNG: Bổ sung cấu hình attempts & backoff vào đây để mọi chu kỳ sau
    // đều có khả năng chống chịu lỗi CSDL hoặc lỗi hệ thống tốt như chu kỳ đầu tiên!
    await this.cronQueue.add(
      jobName,
      {
        taskId,
        jobName,
        cronExpression,
        nextRun: nextRun.toISOString(),
      },
      {
        delay: delayTime,
        jobId: buildTaskJobId(taskId),
        removeOnComplete: true,
        attempts: 3,
        backoff: {
          type: 'fixed',
          delay: 5000,
        },
      },
    );

    this.logger.log(`[Re-enqueue] Đã đặt lịch chạy tiếp theo cho Task ID ${taskId} vào lúc: ${nextRun.toLocaleTimeString()}`);
  }
}