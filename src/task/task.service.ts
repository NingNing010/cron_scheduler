import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Task } from '@prisma/client';
import { Queue } from 'bullmq';
import { CronExpressionParser } from 'cron-parser';
import { PrismaService } from '../prisma/prisma.service';
import { DYNAMIC_CRON_QUEUE } from '../cron/dynamic-cron.constants';
import { CreateTaskDto } from './dto/create-task.dto';

export type TaskWithSchedule = Task & {
  delay?: number;
};

// Sử dụng ID động gắn với thời gian chạy tiếp theo để chống trùng lặp tuyệt đối
const buildTaskJobId = (taskId: number, timestamp?: number) => `task-${taskId}-${timestamp || Date.now()}`;

@Injectable()
export class TaskService implements OnModuleInit {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    private readonly prismaService: PrismaService,
    @InjectQueue(DYNAMIC_CRON_QUEUE)
    private readonly cronQueue: Queue,
  ) {}

  async onModuleInit() {
    this.logger.log('[Startup Recovery] Đang kiểm tra và khôi phục các tác vụ ACTIVE từ Database...');
    try {
      const activeTasks = await this.prismaService.task.findMany({
        where: { status: 'ACTIVE' },
      });

      let recoveredCount = 0;
      for (const task of activeTasks) {
        try {
          const interval = CronExpressionParser.parse(task.cronExpression);
          let nextRun = interval.next().toDate();

          // Chiến lược Fire Once / Skip: Nếu nextRun cũ trong DB đã trong quá khứ (do server tắt),
          // ta lấy mốc nextRun mới nhất ở tương lai để không bị gửi lặp mail lỗi thời.
          if (nextRun.getTime() <= Date.now()) {
            nextRun = interval.next().toDate();
          }

          const delayTime = Math.max(nextRun.getTime() - Date.now(), 0);
          const jobId = buildTaskJobId(task.id, nextRun.getTime());

          // Đẩy lại vào Redis Queue
          await this.cronQueue.add(
            task.name,
            {
              taskId: task.id,
              jobName: task.name,
              cronExpression: task.cronExpression,
              nextRun: nextRun.toISOString(),
            },
            {
              delay: delayTime,
              jobId: jobId,
              removeOnComplete: true,
              removeOnFail: true,
            },
          );

          // Cập nhật lại nextRun mới nhất vào DB
          await this.prismaService.task.update({
            where: { id: task.id },
            data: { nextRun },
          });

          recoveredCount++;
        } catch (err) {
          // Đã fix lỗi Type Safety (unknown) tại đây:
          const errorMessage = err instanceof Error ? err.message : String(err);
          this.logger.error(`[Startup Recovery] Lỗi khôi phục task ID ${task.id}: ${errorMessage}`);
        }
      }
      this.logger.log(`[Startup Recovery] Đã khôi phục thành công ${recoveredCount}/${activeTasks.length} tác vụ vào Redis Queue.`);
    } catch (error) {
      // Đã fix lỗi Type Safety (unknown) tại đây:
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Startup Recovery] Lỗi kết nối DB khi startup: ${errorMessage}`);
    }
  }

  async create(createTaskDto: CreateTaskDto): Promise<TaskWithSchedule> {
    let nextRun: Date;

    try {
      const interval = CronExpressionParser.parse(createTaskDto.cronExpression);
      nextRun = interval.next().toDate();
    } catch (error) {
      throw new BadRequestException('Invalid cron expression');
    }

    const delayTime = Math.max(nextRun.getTime() - Date.now(), 0);

    // 1. LƯU THÊM 3 TRƯỜNG EMAIL VÀO DATABASE
    const task = await this.prismaService.task.create({
      data: {
        name: createTaskDto.name,
        cronExpression: createTaskDto.cronExpression,
        recipientEmail: createTaskDto.recipientEmail,
        subject: createTaskDto.subject,
        content: createTaskDto.content,
        nextRun,
        status: 'ACTIVE',
      },
    });

    try {
      // Đồng bộ sử dụng ID động gắn với mốc nextRun cho ngay lần tạo đầu tiên
      const taskJobId = buildTaskJobId(task.id, nextRun.getTime());
      const existingJob = await this.cronQueue.getJob(taskJobId);
      if (existingJob) {
        await existingJob.remove();
      }

      // 2. THÊM CẤU HÌNH RETRY CHO BULLMQ
      await this.cronQueue.add(
        task.name,
        {
          taskId: task.id,
          jobName: task.name,
          cronExpression: task.cronExpression,
          nextRun: nextRun.toISOString(),
        },
        {
          delay: delayTime,
          jobId: taskJobId,
          removeOnComplete: true,
          removeOnFail: true,
          attempts: 3, // Thử lại tối đa 3 lần nếu gửi mail thất bại
          backoff: {
            type: 'fixed',
            delay: 5000, // Mỗi lần thử lại cách nhau 5 giây
          },
        },
      );

      return { ...task, delay: delayTime };
    } catch (error) {
      await this.prismaService.task.delete({ where: { id: task.id } });
      const message = error instanceof Error ? error.message : 'Failed to create task';
      throw new BadRequestException(message);
    }
  }

  async findAll() {
    return this.prismaService.task.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(id: number) {
    const task = await this.prismaService.task.findUnique({ where: { id } });

    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }

    // Xóa job đang chờ trong BullMQ (Tìm theo cả pattern ID động cũ nếu cần)
    const job = await this.cronQueue.getJob(buildTaskJobId(id, task.nextRun?.getTime()));
    if (job) {
      await job.remove();
    }

    await this.prismaService.task.delete({ where: { id } });

    return { success: true, message: `Task ${id} deleted successfully` };
  }

  async updateNextRun(taskId: number, nextRun: Date) {
    return this.prismaService.task.update({
      where: { id: taskId },
      data: { nextRun },
    });
  }

  async findActiveById(taskId: number) {
    return this.prismaService.task.findFirst({
      where: { id: taskId, status: 'ACTIVE' },
    });
  }

  // 3. HÀM LẤY LỊCH SỬ GỬI MAIL CỦA TÁC VỤ
  async getTaskLogs(taskId: number) {
    return this.prismaService.jobLog.findMany({
      where: { taskId },
      orderBy: { executedAt: 'desc' },
      take: 50,
    });
  }
}