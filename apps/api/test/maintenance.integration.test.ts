import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedWorld } from "../../../packages/db/src/seed-world";
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
