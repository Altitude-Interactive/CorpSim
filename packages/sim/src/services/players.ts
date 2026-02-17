/**
 * Players Service - Identity and Access Control
 *
 * @module players
 *
 * ## Purpose
 * Manages player identity and access control with handle normalization and validation.
 * Provides the authorization layer for verifying player ownership of resources.
 *
 * ## Key Operations
 * - **resolvePlayerByHandle**: Finds or creates player by normalized handle
 * - **assertPlayerExists**: Validates player existence (throws if not found)
 * - **assertPlayerOwnsCompany**: Authorization check for company access
 * - **assertPlayerOwnsMarketOrder**: Authorization check for order cancellation
 * - **assertPlayerOwnsProductionJob**: Authorization check for job cancellation
 * - **assertPlayerOwnsShipment**: Authorization check for shipment cancellation
 *
 * ## Handle Validation
 * - Must be 1-32 characters
 * - Alphanumeric, underscore, or dash only
 * - Case-sensitive
 * - Trimmed and normalized
 *
 * ## Authorization Pattern
 * Used by API controllers to enforce ownership:
 * 1. Extract player handle from auth context
 * 2. Resolve player ID
 * 3. Assert ownership of resource
 * 4. Proceed with operation if authorized
 *
 * Throws ForbiddenError if ownership check fails.
 *
 * ## Determinism
 * Player IDs are stable (created on first handle resolution).
 * Same handle → same player ID across requests.
 */
import { PrismaClient } from "@prisma/client";
import { DomainInvariantError, ForbiddenError } from "../domain/errors";

function normalizeHandle(handle: string): string {
  const normalized = handle.trim();
  if (normalized.length === 0) {
    throw new DomainInvariantError("player handle is required");
  }
  if (normalized.length > 32) {
    throw new DomainInvariantError("player handle must be at most 32 characters");
  }
  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
    throw new DomainInvariantError("player handle must be alphanumeric, underscore, or dash");
  }

  return normalized;
}

export async function resolvePlayerByHandle(prisma: PrismaClient, handle: string) {
  const normalizedHandle = normalizeHandle(handle);

  return prisma.player.upsert({
    where: { handle: normalizedHandle },
    update: {},
    create: { handle: normalizedHandle },
    select: {
      id: true,
      handle: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function resolvePlayerById(prisma: PrismaClient, playerId: string) {
  const normalizedId = playerId.trim();
  if (normalizedId.length === 0) {
    throw new DomainInvariantError("player id is required");
  }

  const player = await prisma.player.findUnique({
    where: { id: normalizedId },
    select: {
      id: true,
      handle: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!player) {
    throw new ForbiddenError("player access is forbidden");
  }

  return player;
}

export async function listCompaniesOwnedByPlayer(prisma: PrismaClient, playerId: string) {
  return prisma.company.findMany({
    where: { ownerPlayerId: playerId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      isPlayer: true,
      specialization: true,
      cashCents: true,
      ownerPlayerId: true,
      region: {
        select: {
          id: true,
          code: true,
          name: true
        }
      }
    }
  });
}

export async function assertCompanyOwnedByPlayer(
  prisma: PrismaClient,
  playerId: string,
  companyId: string
): Promise<void> {
  const owned = await prisma.company.findFirst({
    where: {
      id: companyId,
      ownerPlayerId: playerId
    },
    select: {
      id: true
    }
  });

  if (!owned) {
    throw new ForbiddenError("company access is forbidden for current player");
  }
}

export async function assertOrderOwnedByPlayer(
  prisma: PrismaClient,
  playerId: string,
  orderId: string
): Promise<void> {
  const owned = await prisma.marketOrder.findFirst({
    where: {
      id: orderId,
      company: {
        ownerPlayerId: playerId
      }
    },
    select: {
      id: true
    }
  });

  if (!owned) {
    throw new ForbiddenError("order access is forbidden for current player");
  }
}

export async function assertProductionJobOwnedByPlayer(
  prisma: PrismaClient,
  playerId: string,
  jobId: string
): Promise<void> {
  const owned = await prisma.productionJob.findFirst({
    where: {
      id: jobId,
      company: {
        ownerPlayerId: playerId
      }
    },
    select: {
      id: true
    }
  });

  if (!owned) {
    throw new ForbiddenError("production job access is forbidden for current player");
  }
}

export async function assertShipmentOwnedByPlayer(
  prisma: PrismaClient,
  playerId: string,
  shipmentId: string
): Promise<void> {
  const owned = await prisma.shipment.findFirst({
    where: {
      id: shipmentId,
      company: {
        ownerPlayerId: playerId
      }
    },
    select: {
      id: true
    }
  });

  if (!owned) {
    throw new ForbiddenError("shipment access is forbidden for current player");
  }
}
