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
