import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  Req,
  UnauthorizedException
} from "@nestjs/common";
import { IsString, IsOptional } from "class-validator";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { DiagnosticsService } from "./diagnostics.service";

interface RequestWithSession {
  session?: UserSession | null;
}

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

interface GetMissingItemLogsQueryDto {
  limit?: string;
  offset?: string;
  source?: string;
}

function parseLimit(value?: string): number {
  if (value === undefined) {
    return 100;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
    throw new BadRequestException("limit must be an integer between 1 and 500");
  }

  return parsed;
}

function parseOffset(value?: string): number {
  if (value === undefined) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new BadRequestException("offset must be a non-negative integer");
  }

  return parsed;
}

function isStaffRole(role: string | string[] | null | undefined): boolean {
  if (!role) {
    return false;
  }
  const roleValues = Array.isArray(role) ? role : role.split(",");
  return roleValues
    .map((entry) => entry.trim().toLowerCase())
    .some((entry) => entry === "admin" || entry === "moderator");
}

@Controller("diagnostics")
export class DiagnosticsController {
  constructor(private readonly diagnosticsService: DiagnosticsService) {}

  private assertStaffSession(request: RequestWithSession): void {
    const session = request.session;
    if (!session?.user?.id) {
      throw new UnauthorizedException("Authentication required");
    }

    if (!isStaffRole(session.user.role)) {
      throw new ForbiddenException("Admin or moderator role required");
    }
  }

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
  async getMissingItemLogs(@Req() request: RequestWithSession, @Query() query: GetMissingItemLogsQueryDto) {
    this.assertStaffSession(request);

    const limit = parseLimit(query.limit);
    const offset = parseOffset(query.offset);

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
  async deleteMissingItemLog(@Req() request: RequestWithSession, @Param("id") id: string) {
    this.assertStaffSession(request);
    await this.diagnosticsService.deleteMissingItemLog(id);
  }

  @Delete("missing-items")
  @HttpCode(HttpStatus.OK)
  async clearMissingItemLogs(@Req() request: RequestWithSession, @Query("source") source?: string) {
    this.assertStaffSession(request);
    const count = await this.diagnosticsService.clearMissingItemLogs(source);
    return { cleared: count };
  }
}
