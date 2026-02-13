import { Prisma, PrismaClient } from "@prisma/client";

export interface SimulationLeaseInput {
  name: string;
  ownerId: string;
  ttlMs: number;
}

export interface AcquireSimulationLeaseOptions {
  allowReentry?: boolean;
}

function validateLeaseInput(input: SimulationLeaseInput): void {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error("simulation lease name must be provided");
  }
  if (!input.ownerId || input.ownerId.trim().length === 0) {
    throw new Error("simulation lease ownerId must be provided");
  }
  if (!Number.isInteger(input.ttlMs) || input.ttlMs <= 0) {
    throw new Error("simulation lease ttlMs must be a positive integer");
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function acquireSimulationLease(
  prisma: PrismaClient,
  input: SimulationLeaseInput,
  options: AcquireSimulationLeaseOptions = {}
): Promise<boolean> {
  validateLeaseInput(input);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.ttlMs);
  const leaseName = input.name.trim();
  const ownerId = input.ownerId.trim();
  const orFilters: Prisma.SimulationLeaseWhereInput[] = [{ expiresAt: { lte: now } }];
  if (options.allowReentry) {
    orFilters.unshift({ ownerId });
  }

  const updated = await prisma.simulationLease.updateMany({
    where: {
      name: leaseName,
      OR: orFilters
    },
    data: {
      ownerId,
      expiresAt
    }
  });
  if (updated.count === 1) {
    return true;
  }

  try {
    await prisma.simulationLease.create({
      data: {
        name: leaseName,
        ownerId,
        expiresAt
      }
    });
    return true;
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      return false;
    }
    throw error;
  }
}

export async function releaseSimulationLease(
  prisma: PrismaClient,
  input: { name: string; ownerId: string }
): Promise<void> {
  const leaseName = input.name.trim();
  const ownerId = input.ownerId.trim();
  await prisma.simulationLease.deleteMany({
    where: {
      name: leaseName,
      ownerId
    }
  });
}
