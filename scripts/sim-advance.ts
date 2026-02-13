import { createPrismaClient } from "@corpsim/db";
import {
  advanceSimulationTicks,
  getWorldTickState
} from "@corpsim/sim";

function parseTicks(args: string[]): number {
  const ticksFlag = args.find((entry) => entry.startsWith("--ticks="));

  if (ticksFlag) {
    return Number.parseInt(ticksFlag.replace("--ticks=", ""), 10);
  }

  const ticksIndex = args.findIndex((entry) => entry === "--ticks" || entry === "-t");

  if (ticksIndex >= 0 && args[ticksIndex + 1]) {
    return Number.parseInt(args[ticksIndex + 1], 10);
  }

  if (args[0]) {
    return Number.parseInt(args[0], 10);
  }

  return 1;
}

async function main(): Promise<void> {
  const ticks = parseTicks(process.argv.slice(2));

  if (!Number.isInteger(ticks) || ticks <= 0) {
    throw new Error("Invalid tick count. Use --ticks <positive integer>.");
  }

  const prisma = createPrismaClient();

  try {
    const before = await getWorldTickState(prisma);
    await advanceSimulationTicks(prisma, ticks);
    const after = await getWorldTickState(prisma);

    console.log(
      `Simulation advanced by ${ticks} tick(s). Tick: ${before?.currentTick ?? 0} -> ${after?.currentTick ?? 0}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Simulation advance failed", error);
  process.exitCode = 1;
});

