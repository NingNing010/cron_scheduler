import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Task } from '@prisma/client';
import { Queue } from 'bullmq';
import { CronExpressionParser } from 'cron-parser';
import { DYNAMIC_CRON_QUEUE } from '../cron/dynamic-cron.constants';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';
import { CreateTaskDto } from './dto/create-task.dto';

export type TaskWithSchedule = Task & {
  delay?: number;
};

const buildTaskJobId = (taskId: number, nextRun: Date) => `task-${taskId}-${nextRun.getTime()}`;

@Injectable()
export class TaskService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskService.name);
  private recoveryIntervalId?: NodeJS.Timeout;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly mailService: MailService,
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
            const nextRun = task.nextRun ?? interval.next().toDate();

          const jobId = buildTaskJobId(task.id, nextRun);
          const existingJob = await this.cronQueue.getJob(jobId);

          if (existingJob) {
            continue;
          }

          const delayTime = Math.max(nextRun.getTime() - Date.now(), 0);

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
              jobId,
              removeOnComplete: true,
              removeOnFail: true,
            },
          );

          await this.prismaService.task.update({
            where: { id: task.id },
            data: { nextRun, status: 'ACTIVE', pausedReason: null },
          });

          recoveredCount++;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`[Startup Recovery] Lỗi khôi phục task ID ${task.id}: ${message}`);
        }
      }

      this.logger.log(`[Startup Recovery] Đã khôi phục thành công ${recoveredCount}/${activeTasks.length} tác vụ vào Redis Queue.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Startup Recovery] Lỗi kết nối DB khi startup: ${message}`);
    }

    this.recoveryIntervalId = setInterval(() => {
      void this.recoverPausedTasks();
      void this.recoverActiveTasks();
    }, 15000);
  }

  async onModuleDestroy() {
    if (this.recoveryIntervalId) {
      clearInterval(this.recoveryIntervalId);
    }
  }

  private async recoverPausedTasks() {
    const healthy = await this.mailService.isHealthy();

    if (!healthy) {
      return;
    }

    const pausedTasks = await this.prismaService.task.findMany({
      where: { status: 'PAUSED' },
    });

    for (const task of pausedTasks) {
      try {
        const interval = CronExpressionParser.parse(task.cronExpression);
            const nextRun = task.nextRun ?? interval.next().toDate();

        const jobId = buildTaskJobId(task.id, nextRun);
        const existingJob = await this.cronQueue.getJob(jobId);

        if (existingJob) {
          continue;
        }

        const delayTime = Math.max(nextRun.getTime() - Date.now(), 0);

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
            jobId,
            removeOnComplete: true,
            removeOnFail: true,
          },
        );

        await this.prismaService.task.update({
          where: { id: task.id },
          data: { status: 'ACTIVE', pausedReason: null, nextRun },
        });

        this.logger.log(`[Recovery] Đã khôi phục task ID ${task.id} sau khi kết nối SMTP trở lại.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`[Recovery FAILED] Task ID ${task.id}: ${message}`);
      }
    }
  }

  private async recoverActiveTasks() {
    try {
      const activeTasks = await this.prismaService.task.findMany({
        where: { status: 'ACTIVE' },
      });

      for (const task of activeTasks) {
        if (!task.nextRun) {
          continue;
        }

        const jobId = buildTaskJobId(task.id, task.nextRun);
        const existingJob = await this.cronQueue.getJob(jobId);

        if (existingJob) {
          continue;
        }

        const delayTime = Math.max(task.nextRun.getTime() - Date.now(), 0);

        await this.cronQueue.add(
          task.name,
          {
            taskId: task.id,
            jobName: task.name,
            cronExpression: task.cronExpression,
            nextRun: task.nextRun.toISOString(),
          },
          {
            delay: delayTime,
            jobId,
            removeOnComplete: true,
            removeOnFail: true,
          },
        );

        this.logger.warn(`[Recovery] Bù lại job bị hụt cho Task ID ${task.id} lúc ${task.nextRun.toLocaleTimeString()}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[Recovery ACTIVE FAILED] ${message}`);
    }
  }

  async create(createTaskDto: CreateTaskDto): Promise<TaskWithSchedule> {
    let nextRun: Date;

    try {
      const interval = CronExpressionParser.parse(createTaskDto.cronExpression);
      nextRun = interval.next().toDate();
    } catch {
      throw new BadRequestException('Invalid cron expression');
    }

    const delayTime = Math.max(nextRun.getTime() - Date.now(), 0);

    const task = await this.prismaService.task.create({
      data: {
        name: createTaskDto.name,
        cronExpression: createTaskDto.cronExpression,
        recipientEmail: createTaskDto.recipientEmail,
        subject: createTaskDto.subject,
        content: createTaskDto.content,
        nextRun,
        status: 'ACTIVE',
        sendCount: 0,
        maxMailCount: 5,
          pausedReason: null,
          finishedAt: null,
      },
    });

    const jobId = buildTaskJobId(task.id, nextRun);

    try {
      const existingJob = await this.cronQueue.getJob(jobId);
      if (existingJob) {
        await existingJob.remove();
      }

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
          jobId,
          removeOnComplete: true,
          removeOnFail: true,
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

    if (task.nextRun) {
      const job = await this.cronQueue.getJob(buildTaskJobId(id, task.nextRun));
      if (job) {
        await job.remove();
      }
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

  async markPaused(taskId: number, reason: string) {
    return this.prismaService.task.update({
      where: { id: taskId },
      data: { status: 'PAUSED', pausedReason: reason },
    });
  }

  async markFinished(taskId: number) {
    return this.prismaService.task.update({
      where: { id: taskId },
      data: { status: 'FINISHED', nextRun: null, finishedAt: new Date(), pausedReason: null },
    });
  }

  async incrementSendCount(taskId: number) {
    return this.prismaService.task.update({
      where: { id: taskId },
      data: { sendCount: { increment: 1 } },
    });
  }

  async findActiveById(taskId: number) {
    return this.prismaService.task.findFirst({
      where: { id: taskId, status: 'ACTIVE' },
    });
  }

  async getTaskLogs(taskId: number) {
    return this.prismaService.jobLog.findMany({
      where: { taskId },
      orderBy: { executedAt: 'desc' },
      take: 50,
    });
  }
}
