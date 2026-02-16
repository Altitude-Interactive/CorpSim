import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus
} from "@nestjs/common";
import { IsString, IsOptional, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";
import { DiagnosticsService } from "./diagnostics.service";

class LogMissingItemDto {
  @IsString()
  @IsOptional()
  itemCode?: string;

  @IsString()
  itemName!: string;

  @IsString()
  context!: string;

  @IsString()
  source!: string;

  @IsString()
  @IsOptional()
  metadata?: string;
}

class GetMissingItemLogsQueryDto {
  @IsInt()
  @Min(1)
  @Max(500)
  @Type(() => Number)
  @IsOptional()
  limit?: number;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  offset?: number;

  @IsString()
  @IsOptional()
  source?: string;
}

@Controller("diagnostics")
export class DiagnosticsController {
  constructor(private readonly diagnosticsService: DiagnosticsService) {}

  @Post("missing-items")
  @HttpCode(HttpStatus.CREATED)
  async logMissingItem(@Body() dto: LogMissingItemDto) {
    await this.diagnosticsService.logMissingItem({
      itemCode: dto.itemCode,
      itemName: dto.itemName,
      context: dto.context,
      source: dto.source,
      metadata: dto.metadata
    });

    return { success: true };
  }

  @Get("missing-items")
  async getMissingItemLogs(@Query() query: GetMissingItemLogsQueryDto) {
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;

    const result = await this.diagnosticsService.getMissingItemLogs(
      limit,
      offset,
      query.source
    );

    return {
      entries: result.entries,
      total: result.total,
      limit,
      offset
    };
  }

  @Delete("missing-items/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMissingItemLog(@Param("id") id: string) {
    await this.diagnosticsService.deleteMissingItemLog(id);
  }

  @Delete("missing-items")
  @HttpCode(HttpStatus.OK)
  async clearMissingItemLogs(@Query("source") source?: string) {
    const count = await this.diagnosticsService.clearMissingItemLogs(source);
    return { cleared: count };
  }
}
