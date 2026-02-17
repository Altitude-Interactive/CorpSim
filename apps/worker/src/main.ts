/**
 * Worker Entry Point - Bootstrap and Orchestration
 *
 * @module worker/main
 *
 * ## Purpose
 * Entry point for the worker process that initializes the simulation execution runtime
 * and routes between different execution modes (one-shot vs. continuous queue processing).
 *
 * ## Execution Modes
 * ### Once Mode (`--once`)
 * - Single iteration execution (one-shot)
 * - Useful for:
 *   - Manual tick advancement
 *   - Testing and debugging
 *   - Cron-based scheduling (alternative to BullMQ)
 * - Optional `--ticks=N` or `-t N` to override default tick count
 * - Exits after completing the iteration
 *
 * ### Queue Mode (default)
 * - Continuous runtime via BullMQ queue
 * - Production mode for:
 *   - Always-on simulation processing
 *   - Horizontal scaling (multiple worker instances)
 *   - Reliable job scheduling with retry/backoff
 * - Runs until SIGINT/SIGTERM received
 * - Graceful shutdown with resource cleanup
 *
 * ## Architecture Role
 * Top-level orchestrator that:
 * - Loads configuration from environment
 * - Initializes database connection
 * - Runs preflight checks (schema validation)
 * - Delegates to appropriate runtime (once or queue)
 * - Handles graceful shutdown (signal handling)
 *
 * ## CLI Arguments
 * - `--once`: Run single iteration and exit
 * - `--ticks=N` or `-t N`: Override default tick count (only with --once)
 *
 * ## Error Handling
 * - Try-finally blocks ensure DB disconnect even on errors
 * - Top-level catch logs error and exits with code 1
 * - Graceful shutdown on SIGINT/SIGTERM (stops queue, disconnects DB)
 * - Prevents duplicate shutdown via `shuttingDown` flag
 *
 * ## Signal Handling
 * - SIGINT (Ctrl+C): Graceful shutdown
 * - SIGTERM (docker stop, k8s): Graceful shutdown
 * - Shutdown sequence: Stop queue → Disconnect DB → Exit
 *
 * ## Use Cases
 * - Production: Run without arguments for continuous processing
 * - Development: Use `--once` for manual testing
 * - CI/Testing: Use `--once --ticks=10` for predictable test runs
 * - Maintenance: Send SIGTERM for graceful stop
 */
import "dotenv/config";
import { createPrismaClient } from "@corpsim/db";
import { loadWorkerConfig } from "./config";
import { assertWorkerDeterminismSchemaReady } from "./preflight";
import { startQueueRuntime } from "./queue-runtime";
import { runWorkerIteration } from "./worker-loop";

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

  try {
    await assertWorkerDeterminismSchemaReady(prisma);

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

    const runtime = await startQueueRuntime(prisma, config);
    console.log("[worker] runtime started");

    let shuttingDown = false;
    const shutdown = async (signal: string) => {
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;
      console.log(`[worker] received ${signal}, stopping...`);
      await runtime.stop();
      await prisma.$disconnect();
      console.log("[worker] stopped");
    };

    process.on("SIGINT", () => {
      void shutdown("SIGINT");
    });
    process.on("SIGTERM", () => {
      void shutdown("SIGTERM");
    });
  } catch (error: unknown) {
    await prisma.$disconnect();
    throw error;
  }
}

main().catch((error: unknown) => {
  console.error("[worker] bootstrap failed", error);
  process.exitCode = 1;
});

