import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ListMarketOrdersDto } from "./dto/list-market-orders.dto";
import { MarketService } from "./market.service";

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
      side: query.side
    });
  }
}
