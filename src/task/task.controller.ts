import { Body, Controller, Delete, Get, Param, Post, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskService } from './task.service';
import { RbacGuard } from '../auth/rbac.guard';
import { Permissions, Roles } from '../auth/rbac.decorator';

@Controller('tasks')
@UseGuards(RbacGuard)
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  @Permissions('task:create')
  create(@Body() createTaskDto: CreateTaskDto) {
    return this.taskService.create(createTaskDto);
  }

  @Get()
  @Permissions('task:read')
  findAll() {
    return this.taskService.findAll();
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.taskService.delete(id);
  }

  @Get(':id/logs')
  @Permissions('task:read')
  getLogs(@Param('id', ParseIntPipe) id: number) {
    return this.taskService.getTaskLogs(id);
  }
}
