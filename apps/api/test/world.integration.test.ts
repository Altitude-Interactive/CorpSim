import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { describe, afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { seedWorld } from "@corpsim/db";
import { HttpErrorFilter } from "../src/common/filters/http-error.filter";
import { PrismaService } from "../src/prisma/prisma.service";
import { AppModule } from "../src/app.module";

describe("world API integration", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
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
  });

  it("returns world tick shape after seed", async () => {
    const response = await request(app.getHttpServer()).get("/v1/world/tick").expect(200);

    expect(response.body).toMatchObject({
      currentTick: 0,
      lockVersion: 0,
      lastAdvancedAt: null
    });
  });

  it("returns simulation health shape", async () => {
    const response = await request(app.getHttpServer()).get("/v1/world/health").expect(200);

    expect(response.body).toMatchObject({
      currentTick: expect.any(Number),
      lockVersion: expect.any(Number),
      lastAdvancedAt: null,
      ordersOpenCount: expect.any(Number),
      ordersTotalCount: expect.any(Number),
      tradesLast100Count: expect.any(Number),
      companiesCount: expect.any(Number),
      botsCount: expect.any(Number),
      sumCashCents: expect.any(String),
      sumReservedCashCents: expect.any(String),
      invariants: {
        hasViolations: expect.any(Boolean),
        truncated: expect.any(Boolean),
        issues: expect.any(Array)
      }
    });
  });

  it("advances world by one tick", async () => {
    await request(app.getHttpServer())
      .post("/v1/world/advance")
      .send({ ticks: 1 })
      .expect(201);

    const tickResponse = await request(app.getHttpServer()).get("/v1/world/tick").expect(200);

    expect(tickResponse.body.currentTick).toBe(1);
    expect(tickResponse.body.lockVersion).toBe(1);
  });

  it("returns 409 when expected lock version does not match", async () => {
    const before = await request(app.getHttpServer()).get("/v1/world/tick").expect(200);

    await request(app.getHttpServer())
      .post("/v1/world/advance")
      .send({
        ticks: 1,
        expectedLockVersion: before.body.lockVersion + 1
      })
      .expect(409);

    const after = await request(app.getHttpServer()).get("/v1/world/tick").expect(200);

    expect(after.body.currentTick).toBe(before.body.currentTick);
    expect(after.body.lockVersion).toBe(before.body.lockVersion);
  });
});

