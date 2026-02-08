import { BadRequestException, Controller, Get, Inject, Query } from "@nestjs/common";
import { ListMarketOrdersDto } from "./dto/list-market-orders.dto";
import { MarketService } from "./market.service";

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

@Controller("v1/market")
export class MarketController {
  private readonly marketService: MarketService;

  constructor(@Inject(MarketService) marketService: MarketService) {
    this.marketService = marketService;
  }

  @Get("orders")
  async listOrders(@Query() query: ListMarketOrdersDto) {
    return this.marketService.listOrders({
      itemId: query.itemId,
      side: query.side,
      companyId: query.companyId,
      limit: parseLimit(query.limit)
    });
  }
}
