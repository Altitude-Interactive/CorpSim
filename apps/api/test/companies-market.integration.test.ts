import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedWorld } from "@corpsim/db";
import { HttpErrorFilter } from "../src/common/filters/http-error.filter";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("companies and market API integration", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let playerCompanyId: string;
  let playerRegionId: string;
  let ironOreId: string;

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
    ironOreId = seeded.itemIds.ironOre;
    const playerCompany = await prisma.company.findUniqueOrThrow({
      where: { id: playerCompanyId },
      select: { regionId: true }
    });
    playerRegionId = playerCompany.regionId;
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

  it("applies inventory region filter and defaults to company region", async () => {
    const industrial = await prisma.region.findUniqueOrThrow({
      where: { code: "INDUSTRIAL" },
      select: { id: true }
    });

    await prisma.inventory.create({
      data: {
        companyId: playerCompanyId,
        itemId: ironOreId,
        regionId: industrial.id,
        quantity: 7,
        reservedQuantity: 0
      }
    });

    const defaultRegionResponse = await request(app.getHttpServer())
      .get(`/v1/companies/${playerCompanyId}/inventory`)
      .expect(200);

    expect(
      defaultRegionResponse.body.every((row: { regionId: string }) => row.regionId === playerRegionId)
    ).toBe(true);

    const industrialResponse = await request(app.getHttpServer())
      .get(`/v1/companies/${playerCompanyId}/inventory`)
      .query({ regionId: industrial.id })
      .expect(200);

    expect(
      industrialResponse.body.every((row: { regionId: string }) => row.regionId === industrial.id)
    ).toBe(true);
    expect(
      industrialResponse.body.some((row: { itemId: string; quantity: number }) => row.itemId === ironOreId && row.quantity === 7)
    ).toBe(true);
  });

  it("returns 403 for inventory of unknown or unowned company", async () => {
    await request(app.getHttpServer()).get("/v1/companies/does-not-exist/inventory").expect(403);
  });

  it("returns market orders and applies filters", async () => {
    await request(app.getHttpServer())
      .post("/v1/market/orders")
      .send({
        companyId: playerCompanyId,
        itemId: ironOreId,
        side: "BUY",
        priceCents: 100,
        quantity: 2
      })
      .expect(201);

    const allOrders = await request(app.getHttpServer()).get("/v1/market/orders").expect(200);
    expect(Array.isArray(allOrders.body)).toBe(true);
    expect(allOrders.body.length).toBeGreaterThan(0);

    const byCompany = await request(app.getHttpServer())
      .get("/v1/market/orders")
      .query({ companyId: playerCompanyId })
      .expect(200);

    expect(byCompany.body.length).toBeGreaterThan(0);
    expect(byCompany.body.every((order: { companyId: string }) => order.companyId === playerCompanyId)).toBe(true);

    const sampleOrder = allOrders.body[0] as {
      itemId: string;
      side: "BUY" | "SELL";
    };

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

    const byRegion = await request(app.getHttpServer())
      .get("/v1/market/orders")
      .query({ regionId: playerRegionId })
      .expect(200);

    expect(byRegion.body.length).toBeGreaterThan(0);
    expect(byRegion.body.every((order: { regionId: string }) => order.regionId === playerRegionId)).toBe(true);

    const withLimit = await request(app.getHttpServer())
      .get("/v1/market/orders")
      .query({ limit: 1 })
      .expect(200);

    expect(withLimit.body.length).toBeLessThanOrEqual(1);
  });

  it("returns recent trades and applies company filter", async () => {
    const allTrades = await request(app.getHttpServer()).get("/v1/market/trades").expect(200);
    expect(Array.isArray(allTrades.body)).toBe(true);

    if (allTrades.body.length === 0) {
      return;
    }

    const firstTrade = allTrades.body[0] as { buyerId: string; sellerId: string };

    const myTrades = await request(app.getHttpServer())
      .get("/v1/market/trades")
      .query({ companyId: firstTrade.buyerId, regionId: playerRegionId })
      .expect(200);

    expect(
      myTrades.body.every(
        (trade: { buyerId: string; sellerId: string; regionId: string }) =>
          (trade.buyerId === firstTrade.buyerId || trade.sellerId === firstTrade.buyerId) &&
          trade.regionId === playerRegionId
      )
    ).toBe(true);
  });

  it("returns item catalog", async () => {
    const response = await request(app.getHttpServer()).get("/v1/items").expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toMatchObject({
      id: expect.any(String),
      code: expect.any(String),
      name: expect.any(String)
    });
  });

  it("lists company focus options", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/companies/specializations")
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.some((row: { code: string }) => row.code === "INDUSTRIAL")).toBe(true);
    expect(response.body.some((row: { code: string }) => row.code === "CONSUMER")).toBe(true);
  });

  it("updates company focus and filters company-scoped item catalog", async () => {
    const beforeItems = await request(app.getHttpServer())
      .get("/v1/items")
      .query({ companyId: playerCompanyId })
      .expect(200);

    expect(beforeItems.body.some((item: { code: string }) => item.code === "IRON_ORE")).toBe(true);
    expect(beforeItems.body.some((item: { code: string }) => item.code === "STEEL_INGOT")).toBe(false);

    const updateResponse = await request(app.getHttpServer())
      .post(`/v1/companies/${playerCompanyId}/specialization`)
      .send({ specialization: "INDUSTRIAL" })
      .expect(201);

    expect(updateResponse.body.specialization).toBe("INDUSTRIAL");

    const afterItems = await request(app.getHttpServer())
      .get("/v1/items")
      .query({ companyId: playerCompanyId })
      .expect(200);

    expect(afterItems.body.some((item: { code: string }) => item.code === "STEEL_INGOT")).toBe(true);
  });

  it("enforces a cooldown between company focus changes", async () => {
    await request(app.getHttpServer())
      .post(`/v1/companies/${playerCompanyId}/specialization`)
      .send({ specialization: "INDUSTRIAL" })
      .expect(201);

    const secondResponse = await request(app.getHttpServer())
      .post(`/v1/companies/${playerCompanyId}/specialization`)
      .send({ specialization: "BIOTECH" })
      .expect(400);

    expect(typeof secondResponse.body.message).toBe("string");
    expect(secondResponse.body.message).toContain("hours");
  });
});

