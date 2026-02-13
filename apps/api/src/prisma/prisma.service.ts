import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { ensureEnvironmentLoaded } from "@corpsim/db";

ensureEnvironmentLoaded();

function shouldRetryConnect(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const prismaCode = (error as { errorCode?: string }).errorCode;
  if (prismaCode === "P1001") {
    return true;
  }

  return error.message.includes("Can't reach database server");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    const maxAttempts = 30;
    const baseDelayMs = 1_000;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.$connect();
        return;
      } catch (error) {
        if (!shouldRetryConnect(error) || attempt === maxAttempts) {
          throw error;
        }

        const delayMs = Math.min(baseDelayMs * attempt, 5_000);
        console.warn(
          `[prisma] database not reachable on attempt ${attempt}/${maxAttempts}; retrying in ${delayMs}ms`
        );
        await sleep(delayMs);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

