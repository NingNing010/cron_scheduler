import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { Response } from 'express';
import { mkdirSync, promises as fsPromises } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../minio/minio.service';
import { BulkGenerateEmployeeDto } from './dto/bulk-generate.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

type EmployeeListOptions = {
  search?: string;
  page?: number;
  limit?: number;
};

type ImportedEmployeeRow = {
  code: string;
  fullName: string;
  email: string;
  phone?: string;
  department?: string;
  position?: string;
  notes?: string;
  rowNumber: number;
};

@Injectable()
export class EmployeeService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly minioService: MinioService,
  ) {}

  async create(createEmployeeDto: CreateEmployeeDto) {
    return this.prismaService.employee.create({
      data: {
        ...createEmployeeDto,
        isSynced: false,
        sourceUpdatedAt: new Date(),
      },
    });
  }

  async findAll(options: EmployeeListOptions = {}) {
    const page = Math.max(Number(options.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(options.limit ?? 20), 1), 200);
    const search = typeof options.search === 'string' ? options.search.trim() : '';

    const where: Prisma.EmployeeWhereInput = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prismaService.$transaction([
      this.prismaService.employee.count({ where }),
      this.prismaService.employee.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  async findOne(id: number) {
    const employee = await this.prismaService.employee.findFirst({
      where: { id, deletedAt: null },
    });

    if (!employee) {
      throw new NotFoundException(`Employee ${id} not found`);
    }

    return employee;
  }

  async update(id: number, updateEmployeeDto: UpdateEmployeeDto) {
    const employee = await this.findOne(id);

    if (updateEmployeeDto.code && updateEmployeeDto.code !== employee.code) {
      const duplicate = await this.prismaService.employee.findFirst({
        where: { code: updateEmployeeDto.code, deletedAt: null },
        select: { id: true },
      });

      if (duplicate) {
        throw new BadRequestException('Mã nhân viên đã tồn tại');
      }
    }

    if (updateEmployeeDto.email && updateEmployeeDto.email !== employee.email) {
      const duplicate = await this.prismaService.employee.findFirst({
        where: { email: updateEmployeeDto.email, deletedAt: null },
        select: { id: true },
      });

      if (duplicate) {
        throw new BadRequestException('Email nhân viên đã tồn tại');
      }
    }

    return this.prismaService.employee.update({
      where: { id },
      data: {
        ...updateEmployeeDto,
        isSynced: false,
        sourceUpdatedAt: new Date(),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prismaService.employee.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isSynced: false,
        sourceUpdatedAt: new Date(),
      },
    });
  }

  async bulkGenerate(dto: BulkGenerateEmployeeDto) {
    const batchSize = dto.batchSize ?? 1000;
    const totalBatches = Math.ceil(dto.count / batchSize);
    let created = 0;

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, dto.count);

      const rows = Array.from({ length: end - start }, (_value, offset) => {
        const index = start + offset + 1;
        return {
          code: `EMP-${Date.now()}-${index}`,
          fullName: `Employee ${index}`,
          email: `employee-${index}@example.com`,
          phone: `090${String(index).padStart(7, '0').slice(-7)}`,
          department: index % 2 === 0 ? 'Operations' : 'Sales',
          position: index % 3 === 0 ? 'Senior Specialist' : 'Staff',
          notes: `Generated record #${index}`,
          isSynced: false,
          sourceUpdatedAt: new Date(),
        };
      });

      const result = await this.prismaService.employee.createMany({
        data: rows,
        skipDuplicates: true,
      });

      created += result.count;
    }

    return {
      success: true,
      requested: dto.count,
      created,
      batchSize,
    };
  }

  async exportToExcel(response: Response, options: EmployeeListOptions = {}) {
    const search = typeof options.search === 'string' ? options.search.trim() : '';
    const batchSize = 2000;
    let lastId = 0;

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: response,
      useSharedStrings: true,
      useStyles: true,
    });

    const worksheet = workbook.addWorksheet('Employees');
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Code', key: 'code', width: 20 },
      { header: 'Full Name', key: 'fullName', width: 28 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Department', key: 'department', width: 18 },
      { header: 'Position', key: 'position', width: 18 },
      { header: 'Notes', key: 'notes', width: 40 },
      { header: 'Avatar URL', key: 'avatarUrl', width: 40 },
      { header: 'Synced', key: 'isSynced', width: 12 },
      { header: 'Created At', key: 'createdAt', width: 22 },
      { header: 'Updated At', key: 'updatedAt', width: 22 },
    ];

    worksheet.getRow(1).font = { bold: true };

    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', `attachment; filename="employees-${Date.now()}.xlsx"`);

    while (true) {
      const where: Prisma.EmployeeWhereInput = {
        deletedAt: null,
        id: { gt: lastId },
        ...(search
          ? {
              OR: [
                { code: { contains: search, mode: 'insensitive' } },
                { fullName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const items = await this.prismaService.employee.findMany({
        where,
        orderBy: { id: 'asc' },
        take: batchSize,
      });

      if (!items.length) {
        break;
      }

      for (const item of items) {
        worksheet.addRow({
          ...item,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        }).commit();
      }

      lastId = items[items.length - 1].id;
    }

    await workbook.commit();
  }

  async importFromExcel(filePath: string) {
    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
      entries: 'emit',
      sharedStrings: 'cache',
      hyperlinks: 'ignore',
      worksheets: 'emit',
    });

    const seenCodes = new Set<string>();
    const seenEmails = new Set<string>();
    const errorRows: Array<Record<string, string | number>> = [];
    let inserted = 0;
    let processed = 0;
    let currentBatch: ImportedEmployeeRow[] = [];

    const flushBatch = async () => {
      if (!currentBatch.length) {
        return;
      }

      const codes = currentBatch.map((row) => row.code);
      const emails = currentBatch.map((row) => row.email);
      const existedEmployees = await this.prismaService.employee.findMany({
        where: {
          OR: [{ code: { in: codes } }, { email: { in: emails } }],
          deletedAt: null,
        },
        select: { code: true, email: true },
      });

      const existedCodes = new Set(existedEmployees.map((employee) => employee.code));
      const existedEmails = new Set(existedEmployees.map((employee) => employee.email));

      const validRows: Prisma.EmployeeCreateManyInput[] = [];

      for (const row of currentBatch) {
        const rowErrors: string[] = [];

        if (!row.code || row.code.length < 3) {
          rowErrors.push('Mã nhân viên không hợp lệ');
        }

        if (!row.fullName || row.fullName.length < 2) {
          rowErrors.push('Tên nhân viên không hợp lệ');
        }

        if (!row.email || !/^\S+@\S+\.\S+$/.test(row.email)) {
          rowErrors.push('Email không hợp lệ');
        }

        if (seenCodes.has(row.code) || existedCodes.has(row.code)) {
          rowErrors.push('Mã nhân viên bị trùng');
        }

        if (seenEmails.has(row.email) || existedEmails.has(row.email)) {
          rowErrors.push('Email bị trùng');
        }

        if (rowErrors.length) {
          errorRows.push({
            rowNumber: row.rowNumber,
            code: row.code,
            fullName: row.fullName,
            email: row.email,
            reason: rowErrors.join('; '),
          });
          continue;
        }

        seenCodes.add(row.code);
        seenEmails.add(row.email);

        validRows.push({
          code: row.code,
          fullName: row.fullName,
          email: row.email,
          phone: row.phone,
          department: row.department,
          position: row.position,
          notes: row.notes,
          isSynced: false,
          sourceUpdatedAt: new Date(),
        });
      }

      if (validRows.length) {
        const result = await this.prismaService.employee.createMany({
          data: validRows,
          skipDuplicates: true,
        });
        inserted += result.count;
      }

      processed += currentBatch.length;
      currentBatch = [];
    };

    for await (const worksheetReader of workbookReader) {
      for await (const row of worksheetReader) {
        if (row.number === 1) {
          continue;
        }

        const code = String(row.getCell(1).text ?? '').trim();
        const fullName = String(row.getCell(2).text ?? '').trim();
        const email = String(row.getCell(3).text ?? '').trim();
        const phone = String(row.getCell(4).text ?? '').trim();
        const department = String(row.getCell(5).text ?? '').trim();
        const position = String(row.getCell(6).text ?? '').trim();
        const notes = String(row.getCell(7).text ?? '').trim();

        currentBatch.push({
          code,
          fullName,
          email,
          phone: phone || undefined,
          department: department || undefined,
          position: position || undefined,
          notes: notes || undefined,
          rowNumber: row.number,
        });

        if (currentBatch.length >= 1000) {
          await flushBatch();
        }
      }
    }

    await flushBatch();

    let errorFileUrl: string | null = null;
    if (errorRows.length) {
      mkdirSync(join(process.cwd(), '.tmp'), { recursive: true });
      const tempFilePath = join(process.cwd(), '.tmp', `employee-import-errors-${Date.now()}.xlsx`);
      const errorWorkbook = new ExcelJS.Workbook();
      const sheet = errorWorkbook.addWorksheet('Import Errors');
      sheet.columns = [
        { header: 'Row', key: 'rowNumber', width: 12 },
        { header: 'Code', key: 'code', width: 18 },
        { header: 'Full Name', key: 'fullName', width: 24 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Reason', key: 'reason', width: 60 },
      ];
      sheet.getRow(1).font = { bold: true };
      sheet.addRows(errorRows);
      await errorWorkbook.xlsx.writeFile(tempFilePath);

      const uploaded = await this.minioService.uploadFile({
        key: `employee-errors/${Date.now()}-errors.xlsx`,
        filePath: tempFilePath,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      errorFileUrl = uploaded.url;
      await fsPromises.unlink(tempFilePath).catch(() => undefined);
    }

    return {
      success: true,
      processed,
      inserted,
      errorCount: errorRows.length,
      errorFileUrl,
    };
  }
}