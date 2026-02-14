import { Prisma } from "@prisma/client";
import { createPrismaClient, ensureEnvironmentLoaded } from "@corpsim/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor, username } from "better-auth/plugins";

ensureEnvironmentLoaded();

const prisma = createPrismaClient();

const MAX_HANDLE_LENGTH = 32;
const FALLBACK_HANDLE = "player";

function normalizeHandleSeed(seed: string): string {
  const normalized = seed
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : FALLBACK_HANDLE;
}

function buildHandleCandidate(base: string, suffix: number): string {
  if (suffix === 0) {
    return base.slice(0, MAX_HANDLE_LENGTH);
  }

  const suffixText = `-${suffix + 1}`;
  const baseMaxLength = Math.max(1, MAX_HANDLE_LENGTH - suffixText.length);
  const trimmedBase = base.slice(0, baseMaxLength).replace(/-+$/g, "");
  return `${trimmedBase || FALLBACK_HANDLE}${suffixText}`;
}

function resolveHandleSeed(user: { username?: unknown; name?: unknown; email?: unknown }): string {
  if (typeof user.username === "string" && user.username.trim().length > 0) {
    return user.username;
  }
  if (typeof user.name === "string" && user.name.trim().length > 0) {
    return user.name;
  }
  if (typeof user.email === "string" && user.email.trim().length > 0) {
    return user.email.split("@")[0] ?? user.email;
  }
  return FALLBACK_HANDLE;
}

function isPrismaUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function ensurePlayerExistsForAuthUser(user: {
  id: string;
  username?: unknown;
  name?: unknown;
  email?: unknown;
}): Promise<void> {
  const existing = await prisma.player.findUnique({
    where: { id: user.id },
    select: { id: true }
  });
  if (existing) {
    return;
  }

  const normalizedBase = normalizeHandleSeed(resolveHandleSeed(user));

  for (let suffix = 0; suffix < 10_000; suffix += 1) {
    const handleCandidate = buildHandleCandidate(normalizedBase, suffix);
    try {
      await prisma.player.create({
        data: {
          id: user.id,
          handle: handleCandidate
        }
      });
      return;
    } catch (error) {
      if (!isPrismaUniqueViolation(error)) {
        throw error;
      }

      const byId = await prisma.player.findUnique({
        where: { id: user.id },
        select: { id: true }
      });
      if (byId) {
        return;
      }
    }
  }

  throw new Error("failed to allocate a unique player handle");
}

function resolveTrustedOrigins(): string[] {
  const sources = [
    process.env.CORS_ORIGIN,
    process.env.APP_URL,
    process.env.WEB_URL,
    process.env.NEXT_PUBLIC_APP_URL
  ];

  const resolved = new Set<string>();
  for (const source of sources) {
    if (!source) {
      continue;
    }
    for (const candidate of source.split(",")) {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        resolved.add(trimmed);
      }
    }
  }
  return Array.from(resolved);
}

function resolveAuthBaseUrl(): string {
  const explicit =
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.API_URL?.trim() ||
    process.env.APP_URL?.trim();

  if (explicit) {
    return explicit;
  }

  const apiPort = process.env.API_PORT?.trim() || process.env.PORT?.trim() || "4310";
  return `http://localhost:${apiPort}`;
}

function resolveAuthSecret(): string {
  const secret =
    process.env.BETTER_AUTH_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim();

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET environment variable is required in production");
  }

  return "corpsim-dev-only-better-auth-secret";
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql"
  }),
  baseURL: resolveAuthBaseUrl(),
  secret: resolveAuthSecret(),
  trustedOrigins: resolveTrustedOrigins(),
  emailAndPassword: {
    enabled: true
  },
  plugins: [
    username(),
    twoFactor({
      trustDeviceMaxAge: 60 * 60 * 24 * 30
    })
  ],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await ensurePlayerExistsForAuthUser(user);
        }
      }
    }
  }
});
