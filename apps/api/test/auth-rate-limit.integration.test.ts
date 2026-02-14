import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedWorld } from "@corpsim/db";
import { HttpErrorFilter } from "../src/common/filters/http-error.filter";
import { PrismaService } from "../src/prisma/prisma.service";

const TEST_PASSWORD = "TestPassword!123";

function uniqueEmail(prefix: string): string {
  return `${prefix}.${randomUUID()}@example.com`;
}

function uniqueUsername(prefix: string): string {
  return `${prefix}${randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

describe("auth rate limit integration", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const previousEnv = {
    AUTH_ENFORCE_GUARD_IN_TESTS: process.env.AUTH_ENFORCE_GUARD_IN_TESTS,
    AUTH_RATE_LIMIT_ENABLED: process.env.AUTH_RATE_LIMIT_ENABLED,
    AUTH_RATE_LIMIT_SIGN_IN_MAX_REQUESTS: process.env.AUTH_RATE_LIMIT_SIGN_IN_MAX_REQUESTS,
    AUTH_RATE_LIMIT_SIGN_IN_WINDOW_SECONDS: process.env.AUTH_RATE_LIMIT_SIGN_IN_WINDOW_SECONDS,
    AUTH_RATE_LIMIT_MAX_REQUESTS: process.env.AUTH_RATE_LIMIT_MAX_REQUESTS,
    AUTH_RATE_LIMIT_WINDOW_SECONDS: process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS
  };

  beforeAll(async () => {
    process.env.AUTH_ENFORCE_GUARD_IN_TESTS = "true";
    process.env.AUTH_RATE_LIMIT_ENABLED = "true";
    process.env.AUTH_RATE_LIMIT_SIGN_IN_MAX_REQUESTS = "2";
    process.env.AUTH_RATE_LIMIT_SIGN_IN_WINDOW_SECONDS = "60";
    process.env.AUTH_RATE_LIMIT_MAX_REQUESTS = "1000";
    process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS = "60";

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
    process.env.AUTH_ENFORCE_GUARD_IN_TESTS = previousEnv.AUTH_ENFORCE_GUARD_IN_TESTS;
    process.env.AUTH_RATE_LIMIT_ENABLED = previousEnv.AUTH_RATE_LIMIT_ENABLED;
    process.env.AUTH_RATE_LIMIT_SIGN_IN_MAX_REQUESTS = previousEnv.AUTH_RATE_LIMIT_SIGN_IN_MAX_REQUESTS;
    process.env.AUTH_RATE_LIMIT_SIGN_IN_WINDOW_SECONDS = previousEnv.AUTH_RATE_LIMIT_SIGN_IN_WINDOW_SECONDS;
    process.env.AUTH_RATE_LIMIT_MAX_REQUESTS = previousEnv.AUTH_RATE_LIMIT_MAX_REQUESTS;
    process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS = previousEnv.AUTH_RATE_LIMIT_WINDOW_SECONDS;
  });

  it("blocks repeated sign-in attempts after configured threshold", async () => {
    const email = uniqueEmail("rate-limit");
    const username = uniqueUsername("ratelimit");
    const setupAgent = request.agent(app.getHttpServer());

    await setupAgent.post("/api/auth/sign-up/email").send({
      email,
      password: TEST_PASSWORD,
      name: "Rate Limit User",
      username
    }).expect(200);

    await setupAgent.post("/api/auth/sign-out").send({}).expect(200);

    const attackerAgent = request.agent(app.getHttpServer());

    await attackerAgent.post("/api/auth/sign-in/email").send({
      email,
      password: "WrongPassword!123"
    }).expect(401);

    await attackerAgent.post("/api/auth/sign-in/email").send({
      email,
      password: "WrongPassword!123"
    }).expect(401);

    const limitedResponse = await attackerAgent.post("/api/auth/sign-in/email").send({
      email,
      password: "WrongPassword!123"
    });

    expect(limitedResponse.status).toBe(429);
  });
});
