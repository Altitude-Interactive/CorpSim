import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface LogMissingItemInput {
  itemCode?: string;
  itemName: string;
  context: string;
  source: string;
  metadata?: string;
}

export interface MissingItemLogEntry {
  id: string;
  itemCode: string | null;
  itemName: string;
  context: string;
  source: string;
  metadata: string | null;
  createdAt: Date;
}

@Injectable()
export class DiagnosticsService {
  constructor(private readonly prisma: PrismaService) {}

  async logMissingItem(input: LogMissingItemInput): Promise<void> {
    await this.prisma.missingItemLog.create({
      data: {
        itemCode: input.itemCode ?? null,
        itemName: input.itemName,
        context: input.context,
        source: input.source,
        metadata: input.metadata ?? null
      }
    });
  }

  async getMissingItemLogs(
    limit = 100,
    offset = 0,
    source?: string
  ): Promise<{ entries: MissingItemLogEntry[]; total: number }> {
    const where = source ? { source } : undefined;

    const [entries, total] = await Promise.all([
      this.prisma.missingItemLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset
      }),
      this.prisma.missingItemLog.count({ where })
    ]);

    return { entries, total };
  }

  async deleteMissingItemLog(id: string): Promise<void> {
    try {
      await this.prisma.missingItemLog.delete({
        where: { id }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new NotFoundException(`Missing item log with id ${id} not found`);
      }
      throw error;
    }
  }

  async clearMissingItemLogs(source?: string): Promise<number> {
    const where = source ? { source } : undefined;
    const result = await this.prisma.missingItemLog.deleteMany({ where });
    return result.count;
  }
}
