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
import { ShipmentStatus } from "@prisma/client";
import { CurrentPlayerHandle } from "../common/decorators/current-player-handle.decorator";
import { CancelShipmentParamDto } from "./dto/cancel-shipment.dto";
import { CreateShipmentDto } from "./dto/create-shipment.dto";
import { ListShipmentsDto } from "./dto/list-shipments.dto";
import { ShipmentsService } from "./shipments.service";

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

@Controller("v1/shipments")
export class ShipmentsController {
  private readonly shipmentsService: ShipmentsService;

  constructor(@Inject(ShipmentsService) shipmentsService: ShipmentsService) {
    this.shipmentsService = shipmentsService;
  }

  @Get()
  async list(
    @Query() query: ListShipmentsDto,
    @CurrentPlayerHandle() playerHandle: string
  ) {
    return this.shipmentsService.list(
      {
        companyId: query.companyId,
        status: query.status as ShipmentStatus | undefined,
        limit: parseLimit(query.limit)
      },
      playerHandle
    );
  }

  @Post()
  async create(
    @Body() body: CreateShipmentDto,
    @CurrentPlayerHandle() playerHandle: string
  ) {
    return this.shipmentsService.create(
      {
        companyId: body.companyId,
        toRegionId: body.toRegionId,
        itemId: body.itemId,
        quantity: body.quantity
      },
      playerHandle
    );
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param() params: CancelShipmentParamDto,
    @CurrentPlayerHandle() playerHandle: string
  ) {
    return this.shipmentsService.cancel(params.id, playerHandle);
  }
}
