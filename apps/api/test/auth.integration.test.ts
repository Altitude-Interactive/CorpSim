import "reflect-metadata";
import { createHmac, randomUUID } from "node:crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request, { SuperAgentTest } from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedWorld } from "@corpsim/db";
import { HttpErrorFilter } from "../src/common/filters/http-error.filter";
import { PrismaService } from "../src/prisma/prisma.service";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TEST_PASSWORD = "TestPassword!123";

function decodeBase32(value: string): Buffer {
  const normalized = value.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = "";
  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) {
      throw new Error(`invalid base32 character: ${char}`);
    }
    bits += index.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTotpCode(secret: string, now = Date.now()): string {
  const key = decodeBase32(secret);
  const counter = Math.floor(now / 1000 / 30);
  const payload = Buffer.alloc(8);
  payload.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", key).update(payload).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binaryCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binaryCode % 1_000_000).padStart(6, "0");
}

function uniqueEmail(prefix: string): string {
  return `${prefix}.${randomUUID()}@example.com`;
}

function uniqueUsername(prefix: string): string {
  return `${prefix}${randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

async function signUp(
  agent: SuperAgentTest,
  email: string,
  username: string
): Promise<{ userId: string }> {
  const response = await agent.post("/api/auth/sign-up/email").send({
    email,
    password: TEST_PASSWORD,
    name: "Integration User",
    username
  });

  expect(response.status).toBe(200);
  expect(response.body?.user?.id).toEqual(expect.any(String));

  return {
    userId: response.body.user.id as string
  };
}

describe("auth integration", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.AUTH_ENFORCE_GUARD_IN_TESTS = "true";
    const { AppModule } = await import("../src/app.module");

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        transform: false,
        stopAtFirstError: true
      })
    );
    app.useGlobalFilters(new HttpErrorFilter());
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await seedWorld(prisma, { reset: true });
  });

  afterAll(async () => {
    await app.close();
    delete process.env.AUTH_ENFORCE_GUARD_IN_TESTS;
  });

  it("creates a matching player row when a user signs up", async () => {
    const agent = request.agent(app.getHttpServer());
    const email = uniqueEmail("signup");
    const username = uniqueUsername("authuser");

    const { userId } = await signUp(agent, email, username);

    const player = await prisma.player.findUnique({
      where: { id: userId },
      select: { id: true, handle: true }
    });

    expect(player).not.toBeNull();
    expect(player?.id).toBe(userId);
    expect(player?.handle).toBe(username.toLowerCase());
  });

  it("enforces auth on protected routes and allows access after sign in", async () => {
    await request(app.getHttpServer()).get("/v1/players/me").expect(401);

    const agent = request.agent(app.getHttpServer());
    const email = uniqueEmail("signin");
    await signUp(agent, email, uniqueUsername("signin"));

    await agent.post("/api/auth/sign-out").send({}).expect(200);

    await agent.post("/api/auth/sign-in/email").send({
      email,
      password: TEST_PASSWORD
    }).expect(200);

    const meResponse = await agent.get("/v1/players/me").expect(200);
    expect(meResponse.body).toMatchObject({
      id: expect.any(String),
      handle: expect.any(String)
    });
  });

  it("requires totp verification when two-factor is enabled", async () => {
    const agent = request.agent(app.getHttpServer());
    const email = uniqueEmail("twofactor");
    const { userId } = await signUp(agent, email, uniqueUsername("twofactor"));

    const enableResponse = await agent.post("/api/auth/two-factor/enable").send({
      password: TEST_PASSWORD
    }).expect(200);

    const totpUri = String(enableResponse.body?.totpURI ?? "");
    expect(totpUri).toContain("otpauth://");

    const secret = new URL(totpUri).searchParams.get("secret");
    if (!secret) {
      throw new Error("missing TOTP secret");
    }

    const initialCode = generateTotpCode(secret);
    await agent.post("/api/auth/two-factor/verify-totp").send({
      code: initialCode
    }).expect(200);

    const enabledUser = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { twoFactorEnabled: true }
    });
    expect(enabledUser.twoFactorEnabled).toBe(true);

    await agent.post("/api/auth/sign-out").send({}).expect(200);

    const challengeAgent = request.agent(app.getHttpServer());
    await challengeAgent.post("/api/auth/sign-in/email").send({
      email,
      password: TEST_PASSWORD
    }).expect(200);

    await challengeAgent.get("/v1/players/me").expect(401);

    const code = generateTotpCode(secret);
    await challengeAgent.post("/api/auth/two-factor/verify-totp").send({
      code,
      trustDevice: true
    }).expect(200);

    await challengeAgent.get("/v1/players/me").expect(200);
  });
});
