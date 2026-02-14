import { BadRequestException, Controller, Get, Inject, Query } from "@nestjs/common";
import { CurrentPlayerId } from "../common/decorators/current-player-id.decorator";
import { FinanceService } from "./finance.service";
import { GetFinanceSummaryDto } from "./dto/get-finance-summary.dto";
import { ListLedgerDto } from "./dto/list-ledger.dto";

function parsePositiveInteger(
  raw: string | undefined,
  field: string,
  fallback: number,
  max: number
): number {
  if (raw === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new BadRequestException(`${field} must be an integer between 1 and ${max}`);
  }

  return parsed;
}

function parseNonNegativeInteger(raw: string | undefined, field: string): number | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new BadRequestException(`${field} must be a non-negative integer`);
  }

  return parsed;
}

@Controller("v1/finance")
export class FinanceController {
  private readonly financeService: FinanceService;

  constructor(@Inject(FinanceService) financeService: FinanceService) {
    this.financeService = financeService;
  }

  @Get("ledger")
  async ledger(
    @Query() query: ListLedgerDto,
    @CurrentPlayerId() playerId: string
  ) {
    return this.financeService.listLedger(
      {
        companyId: query.companyId,
        fromTick: parseNonNegativeInteger(query.fromTick, "fromTick"),
        toTick: parseNonNegativeInteger(query.toTick, "toTick"),
        entryType: query.entryType,
        referenceType: query.referenceType,
        referenceId: query.referenceId,
        limit: parsePositiveInteger(query.limit, "limit", 100, 500),
        cursor: query.cursor
      },
      playerId
    );
  }

  @Get("summary")
  async summary(
    @Query() query: GetFinanceSummaryDto,
    @CurrentPlayerId() playerId: string
  ) {
    return this.financeService.getSummary(
      {
        companyId: query.companyId,
        windowTicks: parsePositiveInteger(query.windowTicks, "windowTicks", 100, 10_000)
      },
      playerId
    );
  }
}
