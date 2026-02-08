import { PrismaClient } from "@prisma/client";
import { ensureEnvironmentLoaded } from "./env";

export function createPrismaClient(): PrismaClient {
  ensureEnvironmentLoaded();

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });
}
