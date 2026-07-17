import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Task } from '@prisma/client';
import { Queue } from 'bullmq';
import { CronExpressionParser } from 'cron-parser';
import { PrismaService } from '../prisma/prisma.service';
import { DYNAMIC_CRON_QUEUE } from '../cron/dynamic-cron.constants';
import { CreateTaskDto } from './dto/create-task.dto';

export type TaskWithSchedule = Task & {
  delay?: number;
};

const buildTaskJobId = (taskId: number) => `task-${taskId}`;

@Injectable()
export class TaskService {
  constructor(
    private readonly prismaService: PrismaService,
    @InjectQueue(DYNAMIC_CRON_QUEUE)
    private readonly cronQueue: Queue,
  ) {}

  async create(createTaskDto: CreateTaskDto): Promise<TaskWithSchedule> {
    let nextRun: Date;

    try {
      const interval = CronExpressionParser.parse(createTaskDto.cronExpression);
      nextRun = interval.next().toDate();
    } catch (error) {
      throw new BadRequestException('Invalid cron expression');
    }

    const delayTime = Math.max(nextRun.getTime() - Date.now(), 0);

    const task = await this.prismaService.task.create({
      data: {
        name: createTaskDto.name,
        cronExpression: createTaskDto.cronExpression,
        nextRun,
        status: 'ACTIVE',
      },
    });

    try {
      // DB là nguồn dữ liệu chính, queue chỉ là bộ kích hoạt theo thời gian.
      const taskJobId = buildTaskJobId(task.id);
      const existingJob = await this.cronQueue.getJob(taskJobId);
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
          jobId: taskJobId,
          removeOnComplete: true,
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

    // Xóa job đang chờ trong BullMQ trước, sau đó mới xóa bản ghi DB.
    const job = await this.cronQueue.getJob(buildTaskJobId(id));
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
}
