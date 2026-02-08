import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { describe, afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { seedWorld } from "../../../packages/db/src/seed-world";
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

  it("advances world by one tick", async () => {
    await request(app.getHttpServer())
      .post("/v1/world/advance")
      .send({ ticks: 1 })
      .expect(201);

    const tickResponse = await request(app.getHttpServer()).get("/v1/world/tick").expect(200);

    expect(tickResponse.body.currentTick).toBe(1);
    expect(tickResponse.body.lockVersion).toBe(1);
  });
});
