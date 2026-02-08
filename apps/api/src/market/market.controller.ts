import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query
} from "@nestjs/common";
import { CurrentPlayerHandle } from "../common/decorators/current-player-handle.decorator";
import { CancelMarketOrderParamDto } from "./dto/cancel-market-order.dto";
import { CreateMarketOrderDto } from "./dto/create-market-order.dto";
import { GetMarketAnalyticsSummaryDto } from "./dto/get-market-analytics-summary.dto";
import { ListMarketCandlesDto } from "./dto/list-market-candles.dto";
import { ListMarketOrdersDto } from "./dto/list-market-orders.dto";
import { ListMarketTradesDto } from "./dto/list-market-trades.dto";
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

function parseTradesLimit(value?: string): number {
  if (value === undefined) {
    return 50;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) {
    throw new BadRequestException("limit must be an integer between 1 and 200");
  }

  return parsed;
}

function parseCandlesLimit(value?: string): number {
  if (value === undefined) {
    return 200;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 2000) {
    throw new BadRequestException("limit must be an integer between 1 and 2000");
  }

  return parsed;
}

function parseWindowTicks(value?: string): number {
  if (value === undefined) {
    return 200;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10_000) {
    throw new BadRequestException("windowTicks must be an integer between 1 and 10000");
  }

  return parsed;
}

function parseOptionalTick(value: string | undefined, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new BadRequestException(`${field} must be a non-negative integer`);
  }

  return parsed;
}

@Controller("v1/market")
export class MarketController {
  private readonly marketService: MarketService;

  constructor(@Inject(MarketService) marketService: MarketService) {
    this.marketService = marketService;
  }

  @Get("candles")
  async listCandles(@Query() query: ListMarketCandlesDto) {
    return this.marketService.listCandles({
      itemId: query.itemId,
      regionId: query.regionId,
      fromTick: parseOptionalTick(query.fromTick, "fromTick"),
      toTick: parseOptionalTick(query.toTick, "toTick"),
      limit: parseCandlesLimit(query.limit)
    });
  }

  @Get("analytics/summary")
  async getAnalyticsSummary(@Query() query: GetMarketAnalyticsSummaryDto) {
    return this.marketService.getAnalyticsSummary({
      itemId: query.itemId,
      regionId: query.regionId,
      windowTicks: parseWindowTicks(query.windowTicks)
    });
  }

  @Get("orders")
  async listOrders(
    @Query() query: ListMarketOrdersDto,
    @CurrentPlayerHandle() playerHandle: string
  ) {
    return this.marketService.listOrders({
      itemId: query.itemId,
      regionId: query.regionId,
      side: query.side,
      companyId: query.companyId,
      limit: parseLimit(query.limit)
    }, playerHandle);
  }

  @Get("trades")
  async listTrades(@Query() query: ListMarketTradesDto) {
    return this.marketService.listTrades({
      itemId: query.itemId,
      regionId: query.regionId,
      companyId: query.companyId,
      limit: parseTradesLimit(query.limit)
    });
  }

  @Post("orders")
  async placeOrder(
    @Body() body: CreateMarketOrderDto,
    @CurrentPlayerHandle() playerHandle: string
  ) {
    return this.marketService.placeOrder({
      companyId: body.companyId,
      itemId: body.itemId,
      regionId: body.regionId,
      side: body.side,
      priceCents: body.priceCents,
      quantity: body.quantity
    }, playerHandle);
  }

  @Post("orders/:id/cancel")
  @HttpCode(HttpStatus.OK)
  async cancelOrder(
    @Param() params: CancelMarketOrderParamDto,
    @CurrentPlayerHandle() playerHandle: string
  ) {
    return this.marketService.cancelOrder(params.id, playerHandle);
  }
}
