import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModuleBuilder } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DatabaseSchemaReadiness } from "@corpsim/shared";
import { AppModule } from "../src/app.module";
import { HttpErrorFilter } from "../src/common/filters/http-error.filter";
import { SchemaReadinessService } from "../src/schema-readiness/schema-readiness.service";

function applyAppDefaults(app: INestApplication): void {
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
}

describe("schema readiness integration", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    applyAppDefaults(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("exposes schema readiness from health endpoint", async () => {
    const response = await request(app.getHttpServer()).get("/health/readiness").expect(200);

    expect(response.body).toMatchObject({
      ready: expect.any(Boolean),
      status: expect.stringMatching(/^(ready|schema-out-of-date|schema-check-failed)$/),
      checkedAt: expect.any(String),
      issues: expect.any(Array),
      pendingMigrations: expect.any(Array),
      failedMigrations: expect.any(Array),
      extraDatabaseMigrations: expect.any(Array)
    });
  });
});

describe("schema readiness middleware integration", () => {
  let app: INestApplication;
  let previousEnforceSchemaReadiness: string | undefined;

  beforeAll(async () => {
    previousEnforceSchemaReadiness = process.env.ENFORCE_SCHEMA_READINESS;
    process.env.ENFORCE_SCHEMA_READINESS = "true";

    const blockedReadiness: DatabaseSchemaReadiness = {
      ready: false,
      status: "schema-out-of-date",
      checkedAt: new Date("2026-02-14T00:00:00.000Z").toISOString(),
      issues: ["A database update is required before the game can start."],
      pendingMigrations: ["20260215010101_example_update"],
      failedMigrations: [],
      extraDatabaseMigrations: []
    };

    let builder: TestingModuleBuilder = Test.createTestingModule({
      imports: [AppModule]
    });
    builder = builder
      .overrideProvider(SchemaReadinessService)
      .useValue({ getReadiness: async () => blockedReadiness });

    const moduleRef = await builder.compile();
    app = moduleRef.createNestApplication();
    applyAppDefaults(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();

    if (previousEnforceSchemaReadiness === undefined) {
      delete process.env.ENFORCE_SCHEMA_READINESS;
      return;
    }

    process.env.ENFORCE_SCHEMA_READINESS = previousEnforceSchemaReadiness;
  });

  it("blocks game API routes when schema is not ready", async () => {
    await request(app.getHttpServer())
      .get("/v1/world/tick")
      .expect(503)
      .expect((response) => {
        expect(response.body).toMatchObject({
          error: "SCHEMA_NOT_READY",
          message: "Database updates are required before the game can load.",
          status: "schema-out-of-date",
          issues: ["A database update is required before the game can start."],
          pendingMigrations: ["20260215010101_example_update"]
        });
      });
  });

  it("still allows readiness checks while game API is blocked", async () => {
    await request(app.getHttpServer()).get("/health/readiness").expect(200);
  });
});
