import { Prisma } from "@prisma/client";
import { startProductionForCompanyWithTx } from "../../services/production";

export interface ProducerBotInput {
  companyId: string;
  tick: number;
  maxJobsPerTick: number;
}

export async function runProducerBot(
  tx: Prisma.TransactionClient,
  input: ProducerBotInput
): Promise<number> {
  return startProductionForCompanyWithTx(tx, {
    companyId: input.companyId,
    tick: input.tick,
    maxJobs: input.maxJobsPerTick
  });
}
