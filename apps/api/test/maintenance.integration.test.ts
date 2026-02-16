import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedWorld } from "@corpsim/db";
import { AppModule } from "../src/app.module";
import { HttpErrorFilter } from "../src/common/filters/http-error.filter";
import { PrismaService } from "../src/prisma/prisma.service";

describe("maintenance mode integration", () => {
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

    await request(app.getHttpServer())
      .post("/ops/maintenance")
      .send({
        enabled: false
      })
      .expect(201);
  });

  afterEach(async () => {
    await request(app.getHttpServer())
      .post("/ops/maintenance")
      .send({
        enabled: false
      })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it("exposes maintenance state through health endpoint", async () => {
    const response = await request(app.getHttpServer()).get("/health/maintenance").expect(200);

    expect(response.body).toMatchObject({
      enabled: expect.any(Boolean),
      updatedAt: expect.any(String),
      reason: expect.any(String),
      scope: expect.stringMatching(/^(all|web-only)$/)
    });
  });

  it("supports optional eta field in maintenance state", async () => {
    const futureEta = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

    const enableResponse = await request(app.getHttpServer())
      .post("/ops/maintenance")
      .send({
        enabled: true,
        reason: "Scheduled maintenance",
        scope: "all",
        enabledBy: "integration-test",
        eta: futureEta
      })
      .expect(201);

    expect(enableResponse.body).toMatchObject({
      enabled: true,
      reason: "Scheduled maintenance",
      scope: "all",
      eta: futureEta
    });

    const stateResponse = await request(app.getHttpServer()).get("/health/maintenance").expect(200);

    expect(stateResponse.body).toMatchObject({
      enabled: true,
      eta: futureEta
    });
  });

  it("blocks write requests with 503 when maintenance scope is all", async () => {
    const enableResponse = await request(app.getHttpServer())
      .post("/ops/maintenance")
      .send({
        enabled: true,
        reason: "Systems are currently being updated.",
        scope: "all",
        enabledBy: "integration-test"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/v1/world/advance")
      .send({ ticks: 1 })
      .expect(503)
      .expect((response) => {
        expect(response.body).toEqual({
          error: "MAINTENANCE",
          message: "Maintenance mode enabled",
          updatedAt: enableResponse.body.updatedAt,
          reason: "Systems are currently being updated."
        });
      });
  });

  it("allows simulation control reset writes during maintenance mode", async () => {
    await prisma.simulationControlState.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        botsPaused: true,
        processingStopped: true,
        lastInvariantViolationTick: 42,
        lastInvariantViolationAt: new Date()
      },
      update: {
        botsPaused: true,
        processingStopped: true,
        lastInvariantViolationTick: 42,
        lastInvariantViolationAt: new Date()
      }
    });

    await request(app.getHttpServer())
      .post("/ops/maintenance")
      .send({
        enabled: true,
        reason: "Systems are currently being updated.",
        scope: "all",
        enabledBy: "integration-test"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/ops/simulation/control/reset")
      .send({})
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: 1,
          botsPaused: false,
          processingStopped: false,
          lastInvariantViolationTick: null,
          lastInvariantViolationAt: null,
          updatedAt: expect.any(String)
        });
      });
  });

  it("allows writes when maintenance scope is web-only", async () => {
    await request(app.getHttpServer())
      .post("/ops/maintenance")
      .send({
        enabled: true,
        scope: "web-only",
        reason: "Web maintenance only",
        enabledBy: "integration-test"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/v1/world/advance")
      .send({ ticks: 1 })
      .expect(201);
  });
});

