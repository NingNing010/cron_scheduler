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
    let lastProcessedId = 0;

    while (true) {
      const rows = await this.postgresPrismaService.employee.findMany({
        where: { isSynced: false, id: { gt: lastProcessedId } },
        orderBy: { id: 'asc' },
        take: batchSize,
      });

      if (!rows.length) {
        break;
      }

      lastProcessedId = rows[rows.length - 1].id;
      scanned += rows.length;

      const activeRows = rows.filter((row) => !row.deletedAt);
      const deletedRows = rows.filter((row) => Boolean(row.deletedAt));
      const successfulIds: number[] = [];
      const syncedAt = new Date();

      for (const row of activeRows) {
        try {
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
          successfulIds.push(row.id);
          syncedCount++;
        } catch (error) {
          failedCount++;
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Sync failed for employee ${row.code}: ${message}`);
        }
      }

      if (deletedRows.length) {
        try {
          await this.mariaDbPrismaService.employee.deleteMany({
            where: { code: { in: deletedRows.map((row) => row.code) } },
          });
          successfulIds.push(...deletedRows.map((row) => row.id));
          deletedCount += deletedRows.length;
        } catch (error) {
          failedCount += deletedRows.length;
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Delete batch failed: ${message}`);
        }
      }

      if (successfulIds.length > 0) {
        await this.postgresPrismaService.employee.updateMany({
          where: { id: { in: successfulIds } },
          data: { isSynced: true, syncedAt },
        });
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