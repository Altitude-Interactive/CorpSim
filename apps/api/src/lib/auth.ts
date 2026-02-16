import { Prisma } from "@prisma/client";
import { createPrismaClient, ensureEnvironmentLoaded } from "@corpsim/db";
import { betterAuth } from "better-auth";
import { APIError } from "better-call";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, twoFactor, username } from "better-auth/plugins";

ensureEnvironmentLoaded();

const prisma = createPrismaClient();

const MAX_HANDLE_LENGTH = 32;
const FALLBACK_HANDLE = "player";
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 120;
const DEFAULT_SIGN_IN_RATE_LIMIT_WINDOW_SECONDS = 300;
const DEFAULT_SIGN_IN_RATE_LIMIT_MAX_REQUESTS = 8;
const DEFAULT_SIGN_UP_RATE_LIMIT_WINDOW_SECONDS = 900;
const DEFAULT_SIGN_UP_RATE_LIMIT_MAX_REQUESTS = 5;
const DEFAULT_TWO_FACTOR_RATE_LIMIT_WINDOW_SECONDS = 300;
const DEFAULT_TWO_FACTOR_RATE_LIMIT_MAX_REQUESTS = 10;
const DEFAULT_PASSWORD_RESET_RATE_LIMIT_WINDOW_SECONDS = 900;
const DEFAULT_PASSWORD_RESET_RATE_LIMIT_MAX_REQUESTS = 5;
const ADMIN_EMAIL = "admin@corpsim.local";
const ADMIN_NAME = "Admin";
const PLACEHOLDER_EMAIL_DOMAIN = "@corpsim.local";

type RateLimitStorage = "memory" | "database" | "secondary-storage";
type Ipv6SubnetPrefix = 128 | 64 | 48 | 32;
type GoogleAccessType = "offline" | "online";
type GooglePrompt = "none" | "consent" | "select_account" | "select_account consent" | "login";

function parseBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return fallback;
}

function parseIntegerEnv(
  name: string,
  fallback: number,
  options?: { min?: number; max?: number }
): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (typeof options?.min === "number" && parsed < options.min) {
    return fallback;
  }

  if (typeof options?.max === "number" && parsed > options.max) {
    return fallback;
  }

  return parsed;
}

function parseCsvEnv(name: string): string[] {
  const raw = process.env[name];
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseTrimmedEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  if (!value) {
    return null;
  }
  return value;
}

function isAdminRole(role: string | null | undefined): boolean {
  if (!role) {
    return false;
  }
  return role
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .some((entry) => entry === "admin");
}

function isMainAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}

function normalizeUsernameForEmail(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function assertPlaceholderEmailAllowed(user: { email?: unknown; username?: unknown }): void {
  if (typeof user.email !== "string") {
    return;
  }

  const normalizedEmail = user.email.trim().toLowerCase();
  if (normalizedEmail === ADMIN_EMAIL) {
    return;
  }

  if (!normalizedEmail.endsWith(PLACEHOLDER_EMAIL_DOMAIN)) {
    return;
  }

  const normalizedUsername = normalizeUsernameForEmail(user.username);
  if (!normalizedUsername) {
    throw new APIError("BAD_REQUEST", {
      message: "Username is required for Corpsim placeholder emails."
    });
  }

  const expectedEmail = `${normalizedUsername}${PLACEHOLDER_EMAIL_DOMAIN}`;
  if (normalizedEmail !== expectedEmail) {
    throw new APIError("BAD_REQUEST", {
      message: "Username placeholder email must match the username."
    });
  }
}

async function assertAdminNotBanned(
  userUpdate: Partial<{ banned?: boolean } & Record<string, unknown>>,
  context:
    | {
        body?: Record<string, unknown>;
        context?: {
          internalAdapter?: {
            findUserById: (userId: string) => Promise<{ role?: string | null } | null>;
          };
        };
      }
    | null
): Promise<void> {
  if (!userUpdate?.banned) {
    return;
  }

  const userId = context?.body?.userId;
  if (typeof userId !== "string") {
    return;
  }

  const adapter = context?.context?.internalAdapter;
  if (!adapter || typeof adapter.findUserById !== "function") {
    return;
  }

  const targetUser = await adapter.findUserById(userId);
  if (targetUser && isAdminRole(targetUser.role)) {
    throw new APIError("FORBIDDEN", {
      message: "Admin accounts cannot be banned."
    });
  }
}

async function assertAdminRoleChangeAllowed(
  userUpdate: Partial<{ role?: string | string[] | null } & Record<string, unknown>>,
  context:
    | {
        body?: Record<string, unknown>;
        context?: {
          session?: { user?: { email?: string | null } } | null;
          internalAdapter?: {
            findUserById: (userId: string) => Promise<{ role?: string | null; email?: string | null } | null>;
          };
        };
      }
    | null
): Promise<void> {
  if (!("role" in userUpdate)) {
    return;
  }

  const userId = context?.body?.userId;
  if (typeof userId !== "string") {
    return;
  }

  const adapter = context?.context?.internalAdapter;
  if (!adapter || typeof adapter.findUserById !== "function") {
    return;
  }

  const targetUser = await adapter.findUserById(userId);
  if (!targetUser) {
    return;
  }

  const newRoleValue = userUpdate.role;
  const newRoles = Array.isArray(newRoleValue)
    ? newRoleValue
    : typeof newRoleValue === "string"
      ? newRoleValue.split(",")
      : [];
  const nextHasAdmin = newRoles
    .map((entry) => entry.trim().toLowerCase())
    .some((entry) => entry === "admin");

  if (isMainAdminEmail(targetUser.email) && !nextHasAdmin) {
    throw new APIError("FORBIDDEN", {
      message: "Main admin role cannot be removed."
    });
  }

  if (isAdminRole(targetUser.role) && !nextHasAdmin) {
    const actorEmail = context?.context?.session?.user?.email ?? null;
    if (!isMainAdminEmail(actorEmail)) {
      throw new APIError("FORBIDDEN", {
        message: "Only the main admin can remove admin roles."
      });
    }
  }
}

function parseGoogleAccessType(name: string): GoogleAccessType | null {
  const value = parseTrimmedEnv(name)?.toLowerCase();
  if (value === "offline" || value === "online") {
    return value;
  }
  return null;
}

function parseGooglePrompt(name: string): GooglePrompt | null {
  const value = parseTrimmedEnv(name)?.toLowerCase();
  if (
    value === "none" ||
    value === "consent" ||
    value === "select_account" ||
    value === "select_account consent" ||
    value === "login"
  ) {
    return value;
  }
  return null;
}

function resolveRateLimitStorage(): RateLimitStorage {
  const raw = process.env.AUTH_RATE_LIMIT_STORAGE?.trim().toLowerCase();
  if (raw === "memory" || raw === "database" || raw === "secondary-storage") {
    return raw;
  }
  return "memory";
}

function resolveIpv6Subnet(): Ipv6SubnetPrefix {
  const value = parseIntegerEnv("AUTH_IPV6_SUBNET", 64, {
    min: 32,
    max: 128
  });
  if (value === 128 || value === 64 || value === 48 || value === 32) {
    return value;
  }
  return 64;
}

function resolveAuthRateLimit() {
  return {
    enabled: parseBooleanEnv("AUTH_RATE_LIMIT_ENABLED", process.env.NODE_ENV !== "test"),
    storage: resolveRateLimitStorage(),
    window: parseIntegerEnv("AUTH_RATE_LIMIT_WINDOW_SECONDS", DEFAULT_RATE_LIMIT_WINDOW_SECONDS, {
      min: 1
    }),
    max: parseIntegerEnv("AUTH_RATE_LIMIT_MAX_REQUESTS", DEFAULT_RATE_LIMIT_MAX_REQUESTS, {
      min: 1
    }),
    customRules: {
      "/sign-in/email": {
        window: parseIntegerEnv(
          "AUTH_RATE_LIMIT_SIGN_IN_WINDOW_SECONDS",
          DEFAULT_SIGN_IN_RATE_LIMIT_WINDOW_SECONDS,
          { min: 1 }
        ),
        max: parseIntegerEnv(
          "AUTH_RATE_LIMIT_SIGN_IN_MAX_REQUESTS",
          DEFAULT_SIGN_IN_RATE_LIMIT_MAX_REQUESTS,
          { min: 1 }
        )
      },
      "/sign-in/username": {
        window: parseIntegerEnv(
          "AUTH_RATE_LIMIT_SIGN_IN_WINDOW_SECONDS",
          DEFAULT_SIGN_IN_RATE_LIMIT_WINDOW_SECONDS,
          { min: 1 }
        ),
        max: parseIntegerEnv(
          "AUTH_RATE_LIMIT_SIGN_IN_MAX_REQUESTS",
          DEFAULT_SIGN_IN_RATE_LIMIT_MAX_REQUESTS,
          { min: 1 }
        )
      },
      "/sign-up/email": {
        window: parseIntegerEnv(
          "AUTH_RATE_LIMIT_SIGN_UP_WINDOW_SECONDS",
          DEFAULT_SIGN_UP_RATE_LIMIT_WINDOW_SECONDS,
          { min: 1 }
        ),
        max: parseIntegerEnv(
          "AUTH_RATE_LIMIT_SIGN_UP_MAX_REQUESTS",
          DEFAULT_SIGN_UP_RATE_LIMIT_MAX_REQUESTS,
          { min: 1 }
        )
      },
      "/two-factor/verify-totp": {
        window: parseIntegerEnv(
          "AUTH_RATE_LIMIT_TWO_FACTOR_WINDOW_SECONDS",
          DEFAULT_TWO_FACTOR_RATE_LIMIT_WINDOW_SECONDS,
          { min: 1 }
        ),
        max: parseIntegerEnv(
          "AUTH_RATE_LIMIT_TWO_FACTOR_MAX_REQUESTS",
          DEFAULT_TWO_FACTOR_RATE_LIMIT_MAX_REQUESTS,
          { min: 1 }
        )
      },
      "/two-factor/verify-backup-code": {
        window: parseIntegerEnv(
          "AUTH_RATE_LIMIT_TWO_FACTOR_WINDOW_SECONDS",
          DEFAULT_TWO_FACTOR_RATE_LIMIT_WINDOW_SECONDS,
          { min: 1 }
        ),
        max: parseIntegerEnv(
          "AUTH_RATE_LIMIT_TWO_FACTOR_MAX_REQUESTS",
          DEFAULT_TWO_FACTOR_RATE_LIMIT_MAX_REQUESTS,
          { min: 1 }
        )
      },
      "/forget-password": {
        window: parseIntegerEnv(
          "AUTH_RATE_LIMIT_PASSWORD_RESET_WINDOW_SECONDS",
          DEFAULT_PASSWORD_RESET_RATE_LIMIT_WINDOW_SECONDS,
          { min: 1 }
        ),
        max: parseIntegerEnv(
          "AUTH_RATE_LIMIT_PASSWORD_RESET_MAX_REQUESTS",
          DEFAULT_PASSWORD_RESET_RATE_LIMIT_MAX_REQUESTS,
          { min: 1 }
        )
      },
      "/reset-password": {
        window: parseIntegerEnv(
          "AUTH_RATE_LIMIT_PASSWORD_RESET_WINDOW_SECONDS",
          DEFAULT_PASSWORD_RESET_RATE_LIMIT_WINDOW_SECONDS,
          { min: 1 }
        ),
        max: parseIntegerEnv(
          "AUTH_RATE_LIMIT_PASSWORD_RESET_MAX_REQUESTS",
          DEFAULT_PASSWORD_RESET_RATE_LIMIT_MAX_REQUESTS,
          { min: 1 }
        )
      }
    }
  } as const;
}

function resolveAuthAdvancedOptions() {
  const ipAddressHeaders = parseCsvEnv("AUTH_IP_ADDRESS_HEADERS");
  return {
    useSecureCookies: process.env.NODE_ENV === "production",
    disableErrorPage: true,
    ipAddress: {
      ipAddressHeaders:
        ipAddressHeaders.length > 0
          ? ipAddressHeaders
          : [
              "x-client-ip",
              "x-forwarded-for",
              "cf-connecting-ip",
              "x-real-ip",
              "true-client-ip",
              "fly-client-ip"
            ],
      ipv6Subnet: resolveIpv6Subnet()
    }
  } as const;
}

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

function resolveGoogleProviderOptions() {
  const clientId = parseTrimmedEnv("GOOGLE_CLIENT_ID");
  const clientSecret = parseTrimmedEnv("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return null;
  }

  const prompt = parseGooglePrompt("GOOGLE_AUTH_PROMPT");
  const accessType = parseGoogleAccessType("GOOGLE_AUTH_ACCESS_TYPE");

  return {
    clientId,
    clientSecret,
    ...(prompt ? { prompt } : {}),
    ...(accessType ? { accessType } : {})
  } as const;
}

function resolveGitHubProviderOptions() {
  const clientId = parseTrimmedEnv("GITHUB_CLIENT_ID");
  const clientSecret = parseTrimmedEnv("GITHUB_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret
  } as const;
}

function resolveMicrosoftProviderOptions() {
  const clientId = parseTrimmedEnv("MICROSOFT_CLIENT_ID");
  const clientSecret = parseTrimmedEnv("MICROSOFT_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret
  } as const;
}

function resolveDiscordProviderOptions() {
  const clientId = parseTrimmedEnv("DISCORD_CLIENT_ID");
  const clientSecret = parseTrimmedEnv("DISCORD_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret
  } as const;
}

const googleProviderOptions = resolveGoogleProviderOptions();
const githubProviderOptions = resolveGitHubProviderOptions();
const microsoftProviderOptions = resolveMicrosoftProviderOptions();
const discordProviderOptions = resolveDiscordProviderOptions();

async function assertAdminAccountLinking(account: { userId?: string | null; providerId?: string | null }) {
  if (!account.userId || !account.providerId || account.providerId === "credential") {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: account.userId },
    select: { role: true }
  });

  if (user && isAdminRole(user.role)) {
    throw new Error("Admin accounts cannot link external providers.");
  }
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql"
  }),
  baseURL: resolveAuthBaseUrl(),
  secret: resolveAuthSecret(),
  trustedOrigins: resolveTrustedOrigins(),
  rateLimit: resolveAuthRateLimit(),
  advanced: resolveAuthAdvancedOptions(),
  socialProviders: {
    ...(googleProviderOptions ? { google: googleProviderOptions } : {}),
    ...(githubProviderOptions ? { github: githubProviderOptions } : {}),
    ...(microsoftProviderOptions ? { microsoft: microsoftProviderOptions } : {}),
    ...(discordProviderOptions ? { discord: discordProviderOptions } : {})
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github", "microsoft", "discord"],
      allowDifferentEmails: true
    }
  },
  emailAndPassword: {
    enabled: true
  },
  plugins: [
    username(),
    twoFactor({
      trustDeviceMaxAge: 60 * 60 * 24 * 30
    }),
    admin()
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          assertPlaceholderEmailAllowed(user);
        },
        after: async (user) => {
          await ensurePlayerExistsForAuthUser(user);
        }
      },
      update: {
        before: async (user, context) => {
          await assertAdminNotBanned(user, context);
          await assertAdminRoleChangeAllowed(user, context);
        }
      }
    },
    account: {
      create: {
        before: async (account) => {
          await assertAdminAccountLinking(account);
        }
      }
    }
  }
});

async function ensureAdminAccount() {
  const adminPassword = parseTrimmedEnv("ADMIN_PASSWORD");
  if (!adminPassword) {
    return;
  }

  const ctx = await auth.$context;
  const existingUser = await ctx.internalAdapter.findUserByEmail(ADMIN_EMAIL, {
    includeAccounts: true
  });

  let adminUser = existingUser?.user ?? null;
  if (!adminUser) {
    adminUser = await ctx.internalAdapter.createUser({
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      role: "admin"
    });
  } else if (!isAdminRole(adminUser.role)) {
    adminUser = await ctx.internalAdapter.updateUser(adminUser.id, {
      role: "admin"
    });
  }

  if (!adminUser) {
    throw new Error("Unable to create admin user.");
  }

  const hashedPassword = await ctx.password.hash(adminPassword);
  const hasCredentialAccount =
    existingUser?.accounts?.some((account) => account.providerId === "credential") ??
    false;

  if (!hasCredentialAccount) {
    await ctx.internalAdapter.linkAccount({
      userId: adminUser.id,
      providerId: "credential",
      accountId: adminUser.id,
      password: hashedPassword
    });
  } else {
    await ctx.internalAdapter.updatePassword(adminUser.id, hashedPassword);
  }
}

void ensureAdminAccount().catch((error) => {
  console.error("Failed to ensure admin account:", error);
});
