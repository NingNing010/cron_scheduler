import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { BulkGenerateEmployeeDto } from './dto/bulk-generate.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeService } from './employee.service';
import { Permissions, Roles } from '../auth/rbac.decorator';
import { RbacGuard } from '../auth/rbac.guard';

const uploadDir = join(process.cwd(), '.tmp', 'employee-imports');
mkdirSync(uploadDir, { recursive: true });

@Controller('employees')
@UseGuards(RbacGuard)
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  @Permissions('employee:create')
  create(@Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeeService.create(createEmployeeDto);
  }

  @Get()
  @Permissions('employee:read')
  findAll(@Query('page') page?: string, @Query('limit') limit?: string, @Query('search') search?: string) {
    return this.employeeService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
    });
  }

  @Get('export')
  @Permissions('employee:read')
  export(@Res({ passthrough: false }) response: any, @Query('search') search?: string) {
    return this.employeeService.exportToExcel(response, { search });
  }

  @Get(':id')
  @Permissions('employee:read')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.employeeService.findOne(id);
  }

  @Patch(':id')
  @Permissions('employee:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateEmployeeDto: UpdateEmployeeDto) {
    return this.employeeService.update(id, updateEmployeeDto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.employeeService.remove(id);
  }

  @Post('bulk-generate')
  @Permissions('employee:create')
  bulkGenerate(@Body() dto: BulkGenerateEmployeeDto) {
    return this.employeeService.bulkGenerate(dto);
  }

  @Post('import')
  @Permissions('employee:create')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_request, file, callback) => {
          const suffix = extname(file.originalname || '').toLowerCase();
          callback(null, `${randomUUID()}${suffix}`);
        },
      }),
    }),
  )
  async import(@UploadedFile() file: Express.Multer.File) {
    return this.employeeService.importFromExcel(file.path);
  }
}