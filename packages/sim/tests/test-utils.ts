import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Creates a minimal PrismaClient mock that supports $transaction.
 * 
 * Note: This uses `as unknown as PrismaClient` because the actual test
 * implementations only use the $transaction method, but the service functions
 * expect the full PrismaClient type. This is a deliberate trade-off to keep
 * test mocks simple while maintaining type compatibility.
 */
export function createPrismaTransactionMock(
  tx: Prisma.TransactionClient
): PrismaClient {
  return {
    $transaction: async <T>(
      callback: (transactionClient: Prisma.TransactionClient) => Promise<T>
    ): Promise<T> => callback(tx)
  } as unknown as PrismaClient;
}
