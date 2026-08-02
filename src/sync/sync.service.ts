import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MariaDbPrismaService } from '../prisma/mariadb-prisma.service';
import { PrismaService } from '../prisma/prisma.service';

export type SyncEmployeesResult = {
  scanned: number;
  syncedCount: number;
  deletedCount: number;
  failedCount: number;
};

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly postgresPrismaService: PrismaService,
    private readonly mariaDbPrismaService: MariaDbPrismaService,
  ) {}

  async syncEmployees(batchSize = 1000): Promise<SyncEmployeesResult> {
    let scanned = 0;
    let syncedCount = 0;
    let deletedCount = 0;
    let failedCount = 0;

    while (true) {
      const rows = await this.postgresPrismaService.employee.findMany({
        where: { isSynced: false },
        orderBy: { id: 'asc' },
        take: batchSize,
      });

      if (!rows.length) {
        break;
      }

      scanned += rows.length;

      const activeRows = rows.filter((row) => !row.deletedAt);
      const deletedRows = rows.filter((row) => Boolean(row.deletedAt));

      try {
        for (const row of activeRows) {
          await this.mariaDbPrismaService.employee.upsert({
            where: { code: row.code },
            create: {
              code: row.code,
              fullName: row.fullName,
              email: row.email,
              phone: row.phone,
              department: row.department,
              position: row.position,
              notes: row.notes,
              avatarKey: row.avatarKey,
              avatarUrl: row.avatarUrl,
              isSynced: true,
              syncedAt: new Date(),
              sourceUpdatedAt: row.sourceUpdatedAt,
              deletedAt: null,
            },
            update: {
              fullName: row.fullName,
              email: row.email,
              phone: row.phone,
              department: row.department,
              position: row.position,
              notes: row.notes,
              avatarKey: row.avatarKey,
              avatarUrl: row.avatarUrl,
              isSynced: true,
              syncedAt: new Date(),
              sourceUpdatedAt: row.sourceUpdatedAt,
              deletedAt: null,
            },
          });
        }

        if (deletedRows.length) {
          await this.mariaDbPrismaService.employee.deleteMany({
            where: { code: { in: deletedRows.map((row) => row.code) } },
          });
        }

        const syncedAt = new Date();
        await this.postgresPrismaService.employee.updateMany({
          where: { id: { in: rows.map((row) => row.id) } },
          data: { isSynced: true, syncedAt },
        });

        syncedCount += activeRows.length;
        deletedCount += deletedRows.length;
      } catch (error) {
        failedCount += rows.length;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Sync batch failed: ${message}`);
        throw error;
      }
    }

    await this.postgresPrismaService.syncRunLog.create({
      data: {
        jobName: 'employee-sync',
        status: failedCount > 0 ? 'FAILED' : 'COMPLETED',
        sourceCount: scanned,
        syncedCount,
        failedCount,
        message: failedCount > 0 ? 'Có lỗi trong quá trình đồng bộ' : 'Đồng bộ thành công',
      },
    });

    return {
      scanned,
      syncedCount,
      deletedCount,
      failedCount,
    };
  }
}