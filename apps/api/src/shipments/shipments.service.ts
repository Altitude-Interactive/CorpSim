import { Inject, Injectable } from "@nestjs/common";
import { ShipmentStatus } from "@prisma/client";
import {
  assertCompanyOwnedByPlayer,
  assertShipmentOwnedByPlayer,
  cancelShipment,
  createShipment,
  listShipments,
  resolvePlayerByHandle
} from "../../../../packages/sim/src";
import { PrismaService } from "../prisma/prisma.service";

interface ListShipmentsInput {
  companyId?: string;
  status?: ShipmentStatus;
  limit?: number;
}

interface CreateShipmentInput {
  companyId: string;
  toRegionId: string;
  itemId: string;
  quantity: number;
}

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

function mapShipmentToDto(shipment: ShipmentLike) {
  return {
    id: shipment.id,
    companyId: shipment.companyId,
    fromRegionId: shipment.fromRegionId,
    toRegionId: shipment.toRegionId,
    itemId: shipment.itemId,
    quantity: shipment.quantity,
    status: shipment.status,
    tickCreated: shipment.tickCreated,
    tickArrives: shipment.tickArrives,
    tickClosed: shipment.tickClosed,
    createdAt: shipment.createdAt,
    updatedAt: shipment.updatedAt,
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

  async list(input: ListShipmentsInput, playerHandle: string) {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);
    if (input.companyId) {
      await assertCompanyOwnedByPlayer(this.prisma, player.id, input.companyId);
    }

    const rows = await listShipments(this.prisma, {
      playerId: player.id,
      companyId: input.companyId,
      status: input.status,
      limit: input.limit
    });

    return rows.map(mapShipmentToDto);
  }

  async create(input: CreateShipmentInput, playerHandle: string) {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);
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

  async cancel(shipmentId: string, playerHandle: string) {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);
    await assertShipmentOwnedByPlayer(this.prisma, player.id, shipmentId);

    const shipment = await cancelShipment(this.prisma, { shipmentId });
    return mapShipmentToDto(shipment);
  }
}
