/**
 * Regions Service
 *
 * @module regions
 *
 * ## Purpose
 * Provides database query functions for retrieving geographic region data.
 * Regions represent different trading zones in the simulation with distinct
 * markets and logistics costs.
 *
 * ## Key Operations
 * - **listRegions**: Fetches all regions sorted by code
 * - **getRegionById**: Retrieves specific region with validation (throws NotFoundError if missing)
 *
 * ## Usage
 * Used throughout the simulation for:
 * - Market order placement (orders tied to regions)
 * - Shipment logistics (inter-region travel times)
 * - Company region ownership validation
 * - Region-specific market candles and analytics
 */
import { PrismaClient } from "@prisma/client";
import { NotFoundError } from "../domain/errors";

export async function listRegions(prisma: PrismaClient) {
  return prisma.region.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true
    }
  });
}

export async function getRegionById(prisma: PrismaClient, regionId: string) {
  const region = await prisma.region.findUnique({
    where: { id: regionId },
    select: {
      id: true,
      code: true,
      name: true
    }
  });

  if (!region) {
    throw new NotFoundError(`region ${regionId} not found`);
  }

  return region;
}
