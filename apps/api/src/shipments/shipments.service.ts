import { Inject, Injectable } from "@nestjs/common";
import { ShipmentStatus } from "@prisma/client";
import type {
  CreateShipmentInput,
  ListShipmentsFilters,
  ShipmentRecord
} from "@corpsim/shared";
import {
  assertCompanyOwnedByPlayer,
  assertShipmentOwnedByPlayer,
  cancelShipment,
  createShipment,
  listShipments,
  resolvePlayerById
} from "@corpsim/sim";
import { PrismaService } from "../prisma/prisma.service";

interface ShipmentLike {
  id: string;
  companyId: string;
  fromRegionId: string;
  toRegionId: string;
  itemId: string;
  quantity: number;
  status: ShipmentStatus;
  tickCreated: number;
  tickArrives: number;
  tickClosed: number | null;
  createdAt: Date;
  updatedAt: Date;
  item: {
    id: string;
    code: string;
    name: string;
  };
  fromRegion: {
    id: string;
    code: string;
    name: string;
  };
  toRegion: {
    id: string;
    code: string;
    name: string;
  };
}

function parseNonNegativeBigIntEnv(name: string, fallback: bigint): bigint {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = BigInt(raw);
  if (parsed < 0n) {
    throw new Error(`${name} must be a non-negative integer`);
  }

  return parsed;
}

function mapShipmentToDto(shipment: ShipmentLike): ShipmentRecord {
  return {
    id: shipment.id,
    companyId: shipment.companyId,
    fromRegionId: shipment.fromRegionId,
    toRegionId: shipment.toRegionId,
    itemId: shipment.itemId,
    quantity: shipment.quantity,
    status: shipment.status as ShipmentRecord["status"],
    tickCreated: shipment.tickCreated,
    tickArrives: shipment.tickArrives,
    tickClosed: shipment.tickClosed,
    createdAt: shipment.createdAt.toISOString(),
    updatedAt: shipment.updatedAt.toISOString(),
    item: shipment.item,
    fromRegion: shipment.fromRegion,
    toRegion: shipment.toRegion
  };
}

@Injectable()
export class ShipmentsService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  private resolveShipmentConfig() {
    return {
      baseFeeCents: parseNonNegativeBigIntEnv("SHIPMENT_BASE_FEE_CENTS", 250n),
      feePerUnitCents: parseNonNegativeBigIntEnv("SHIPMENT_FEE_PER_UNIT_CENTS", 15n)
    };
  }

  async list(input: ListShipmentsFilters, playerId: string): Promise<ShipmentRecord[]> {
    const player = await resolvePlayerById(this.prisma, playerId);
    if (input.companyId) {
      await assertCompanyOwnedByPlayer(this.prisma, player.id, input.companyId);
    }

    const rows = await listShipments(this.prisma, {
      playerId: player.id,
      companyId: input.companyId,
      status: input.status as ShipmentStatus | undefined,
      limit: input.limit
    });

    return rows.map(mapShipmentToDto);
  }

  async create(input: CreateShipmentInput, playerId: string): Promise<ShipmentRecord> {
    const player = await resolvePlayerById(this.prisma, playerId);
    await assertCompanyOwnedByPlayer(this.prisma, player.id, input.companyId);

    const shipment = await createShipment(
      this.prisma,
      {
        companyId: input.companyId,
        toRegionId: input.toRegionId,
        itemId: input.itemId,
        quantity: input.quantity
      },
      this.resolveShipmentConfig()
    );

    return mapShipmentToDto(shipment);
  }

  async cancel(shipmentId: string, playerId: string): Promise<ShipmentRecord> {
    const player = await resolvePlayerById(this.prisma, playerId);
    await assertShipmentOwnedByPlayer(this.prisma, player.id, shipmentId);

    const shipment = await cancelShipment(this.prisma, { shipmentId });
    return mapShipmentToDto(shipment);
  }
}

