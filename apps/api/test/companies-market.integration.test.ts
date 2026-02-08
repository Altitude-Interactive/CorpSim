import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedWorld } from "../../../packages/db/src/seed-world";
import { HttpErrorFilter } from "../src/common/filters/http-error.filter";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("companies and market API integration", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let playerCompanyId: string;

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
    const seeded = await seedWorld(prisma, { reset: true });
    playerCompanyId = seeded.companyIds.player;
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns company inventory rows with item metadata", async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/companies/${playerCompanyId}/inventory`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toMatchObject({
      itemId: expect.any(String),
      itemCode: expect.any(String),
      itemName: expect.any(String),
      quantity: expect.any(Number),
      reservedQuantity: expect.any(Number)
    });
  });

  it("returns 404 for inventory of unknown company", async () => {
    await request(app.getHttpServer()).get("/v1/companies/does-not-exist/inventory").expect(404);
  });

  it("returns market orders and applies filters", async () => {
    const allOrders = await request(app.getHttpServer()).get("/v1/market/orders").expect(200);
    expect(Array.isArray(allOrders.body)).toBe(true);
    expect(allOrders.body.length).toBeGreaterThan(0);

    const sampleOrder = allOrders.body[0] as {
      companyId: string;
      itemId: string;
      side: "BUY" | "SELL";
    };

    const byCompany = await request(app.getHttpServer())
      .get("/v1/market/orders")
      .query({ companyId: sampleOrder.companyId })
      .expect(200);

    expect(byCompany.body.length).toBeGreaterThan(0);
    expect(byCompany.body.every((order: { companyId: string }) => order.companyId === sampleOrder.companyId)).toBe(true);

    const bySide = await request(app.getHttpServer())
      .get("/v1/market/orders")
      .query({ side: sampleOrder.side })
      .expect(200);

    expect(bySide.body.length).toBeGreaterThan(0);
    expect(bySide.body.every((order: { side: string }) => order.side === sampleOrder.side)).toBe(true);

    const byItem = await request(app.getHttpServer())
      .get("/v1/market/orders")
      .query({ itemId: sampleOrder.itemId })
      .expect(200);

    expect(byItem.body.length).toBeGreaterThan(0);
    expect(byItem.body.every((order: { itemId: string }) => order.itemId === sampleOrder.itemId)).toBe(true);

    const withLimit = await request(app.getHttpServer())
      .get("/v1/market/orders")
      .query({ limit: 1 })
      .expect(200);

    expect(withLimit.body.length).toBeLessThanOrEqual(1);
  });
});
