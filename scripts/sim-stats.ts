import { createPrismaClient } from "@corpsim/db";
import { getSimulationHealth } from "@corpsim/sim";

function parseInvariantIssueLimit(args: string[]): number {
  const limitFlag = args.find((entry) => entry.startsWith("--invariant-limit="));

  if (limitFlag) {
    return Number.parseInt(limitFlag.replace("--invariant-limit=", ""), 10);
  }

  const limitIndex = args.findIndex((entry) => entry === "--invariant-limit");

  if (limitIndex >= 0 && args[limitIndex + 1]) {
    return Number.parseInt(args[limitIndex + 1], 10);
  }

  return 20;
}

async function main(): Promise<void> {
  const issueLimit = parseInvariantIssueLimit(process.argv.slice(2));

  if (!Number.isInteger(issueLimit) || issueLimit <= 0) {
    throw new Error("Invalid invariant issue limit. Use --invariant-limit <positive integer>.");
  }

  const prisma = createPrismaClient();

  try {
    const health = await getSimulationHealth(prisma, {
      invariantIssueLimit: issueLimit
    });

    const payload = {
      currentTick: health.currentTick,
      lockVersion: health.lockVersion,
      lastAdvancedAt: health.lastAdvancedAt,
      ordersOpenCount: health.ordersOpenCount,
      ordersTotalCount: health.ordersTotalCount,
      tradesLast100Count: health.tradesLast100Count,
      companiesCount: health.companiesCount,
      botsCount: health.botsCount,
      sumCashCents: health.sumCashCents.toString(),
      sumReservedCashCents: health.sumReservedCashCents.toString(),
      invariants: {
        hasViolations: health.invariants.hasViolations,
        truncated: health.invariants.truncated,
        issueCount: health.invariants.issues.length,
        issues: health.invariants.issues
      }
    };

    console.log(JSON.stringify(payload, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Simulation stats failed", error);
  process.exitCode = 1;
});
