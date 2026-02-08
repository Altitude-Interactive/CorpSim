import "dotenv/config";
import { createPrismaClient } from "../../../packages/db/src/client";
import { loadWorkerConfig } from "./config";
import { runWorkerIteration, startWorkerLoop } from "./worker-loop";

function parseTicks(args: string[]): number | undefined {
  const withEquals = args.find((entry) => entry.startsWith("--ticks="));
  if (withEquals) {
    return Number.parseInt(withEquals.replace("--ticks=", ""), 10);
  }

  const index = args.findIndex((entry) => entry === "--ticks" || entry === "-t");
  if (index >= 0 && args[index + 1]) {
    return Number.parseInt(args[index + 1], 10);
  }

  return undefined;
}

function isOnceMode(args: string[]): boolean {
  return args.includes("--once");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const config = loadWorkerConfig();
  const prisma = createPrismaClient();

  if (isOnceMode(args)) {
    try {
      const result = await runWorkerIteration(prisma, config, {
        ticksOverride: parseTicks(args)
      });
      console.log(
        `[worker:once] ticks +${result.ticksAdvanced} (${result.tickBefore} -> ${result.tickAfter}) retries=${result.retries}`
      );
      return;
    } finally {
      await prisma.$disconnect();
    }
  }

  const loop = startWorkerLoop(prisma, config);
  console.log(
    `[worker] started interval=${config.tickIntervalMs}ms speed=${config.simulationSpeed} maxTicksPerRun=${config.maxTicksPerRun}`
  );

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log(`[worker] received ${signal}, stopping...`);
    await loop.stop();
    await prisma.$disconnect();
    console.log("[worker] stopped");
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

main().catch((error: unknown) => {
  console.error("[worker] bootstrap failed", error);
  process.exitCode = 1;
});
