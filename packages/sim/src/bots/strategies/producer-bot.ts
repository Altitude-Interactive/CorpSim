import { Prisma } from "@prisma/client";
import { startProfitableProductionForCompanyWithTx } from "../../services/production";

export interface ProducerBotInput {
  companyId: string;
  tick: number;
  maxJobsPerTick: number;
  cadenceTicks: number;
  minProfitBps: number;
  referencePriceByItemId: Map<string, bigint>;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 2_147_483_647;
  }
  return hash;
}

function shouldRunOnTick(companyId: string, tick: number, cadenceTicks: number): boolean {
  if (cadenceTicks <= 1) {
    return true;
  }

  const offset = hashString(companyId) % cadenceTicks;
  return tick % cadenceTicks === offset;
}

export async function runProducerBot(
  tx: Prisma.TransactionClient,
  input: ProducerBotInput
): Promise<number> {
  if (!shouldRunOnTick(input.companyId, input.tick, input.cadenceTicks)) {
    return 0;
  }

  return startProfitableProductionForCompanyWithTx(tx, {
    companyId: input.companyId,
    tick: input.tick,
    maxJobs: input.maxJobsPerTick,
    minProfitBps: input.minProfitBps,
    referencePriceByItemId: input.referencePriceByItemId
  });
}
