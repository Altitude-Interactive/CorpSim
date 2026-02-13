import { PrismaClient } from "@prisma/client";

export interface SimulationControlSnapshot {
  botsPaused: boolean;
  processingStopped: boolean;
}

export async function ensureSimulationControlState(
  prisma: PrismaClient
): Promise<SimulationControlSnapshot> {
  const state = await prisma.simulationControlState.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      botsPaused: false,
      processingStopped: false
    },
    update: {},
    select: {
      botsPaused: true,
      processingStopped: true
    }
  });

  return state;
}

export async function pauseBotsAfterInvariantViolation(
  prisma: PrismaClient,
  tick: number
): Promise<void> {
  await prisma.simulationControlState.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      botsPaused: true,
      processingStopped: false,
      lastInvariantViolationTick: tick,
      lastInvariantViolationAt: new Date()
    },
    update: {
      botsPaused: true,
      lastInvariantViolationTick: tick,
      lastInvariantViolationAt: new Date()
    }
  });
}

export async function stopSimulationAfterInvariantViolation(
  prisma: PrismaClient,
  tick: number
): Promise<void> {
  await prisma.simulationControlState.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      botsPaused: true,
      processingStopped: true,
      lastInvariantViolationTick: tick,
      lastInvariantViolationAt: new Date()
    },
    update: {
      botsPaused: true,
      processingStopped: true,
      lastInvariantViolationTick: tick,
      lastInvariantViolationAt: new Date()
    }
  });
}
