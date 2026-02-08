import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedWorld } from "../../../packages/db/src/seed-world";
import { HttpErrorFilter } from "../src/common/filters/http-error.filter";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("shipments API integration", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let playerCompanyId: string;
  let playerRegionId: string;
  let industrialRegionId: string;
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

    const [playerCompany, industrialRegion] = await Promise.all([
      prisma.company.findUniqueOrThrow({
        where: { id: playerCompanyId },
        select: { regionId: true }
      }),
      prisma.region.findUniqueOrThrow({
        where: { code: "INDUSTRIAL" },
        select: { id: true }
      })
    ]);

    playerRegionId = playerCompany.regionId;
    industrialRegionId = industrialRegion.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates shipment, charges fee, and delivers after travel time", async () => {
    const quantity = 5;
    const expectedFee = 250n + 15n * BigInt(quantity);

    const [companyBefore, sourceInventoryBefore] = await Promise.all([
      prisma.company.findUniqueOrThrow({
        where: { id: playerCompanyId },
        select: { cashCents: true }
      }),
      prisma.inventory.findUniqueOrThrow({
        where: {
          companyId_itemId_regionId: {
            companyId: playerCompanyId,
            itemId: ironOreId,
            regionId: playerRegionId
          }
        },
        select: { quantity: true }
      })
    ]);

    const createResponse = await request(app.getHttpServer())
      .post("/v1/shipments")
      .send({
        companyId: playerCompanyId,
        toRegionId: industrialRegionId,
        itemId: ironOreId,
        quantity
      })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      id: expect.any(String),
      companyId: playerCompanyId,
      fromRegionId: playerRegionId,
      toRegionId: industrialRegionId,
      itemId: ironOreId,
      quantity,
      status: "IN_TRANSIT",
      tickCreated: 0,
      tickArrives: 5
    });

    const [companyAfterCreate, sourceInventoryAfterCreate] = await Promise.all([
      prisma.company.findUniqueOrThrow({
        where: { id: playerCompanyId },
        select: { cashCents: true }
      }),
      prisma.inventory.findUniqueOrThrow({
        where: {
          companyId_itemId_regionId: {
            companyId: playerCompanyId,
            itemId: ironOreId,
            regionId: playerRegionId
          }
        },
        select: { quantity: true }
      })
    ]);

    expect(companyAfterCreate.cashCents).toBe(companyBefore.cashCents - expectedFee);
    expect(sourceInventoryAfterCreate.quantity).toBe(sourceInventoryBefore.quantity - quantity);

    const shipmentId = createResponse.body.id as string;

    await request(app.getHttpServer())
      .post("/v1/world/advance")
      .send({ ticks: 5 })
      .expect(201);

    const shipmentAfterDelivery = await prisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
      select: { status: true, tickClosed: true }
    });
    expect(shipmentAfterDelivery.status).toBe("DELIVERED");
    expect(shipmentAfterDelivery.tickClosed).toBe(5);

    const destinationInventory = await prisma.inventory.findUniqueOrThrow({
      where: {
        companyId_itemId_regionId: {
          companyId: playerCompanyId,
          itemId: ironOreId,
          regionId: industrialRegionId
        }
      },
      select: { quantity: true, reservedQuantity: true }
    });

    expect(destinationInventory.quantity).toBe(quantity);
    expect(destinationInventory.reservedQuantity).toBe(0);
  });

  it("cancels in-transit shipment and returns source inventory without fee refund", async () => {
    const quantity = 4;
    const expectedFee = 250n + 15n * BigInt(quantity);

    const [companyBefore, sourceBefore] = await Promise.all([
      prisma.company.findUniqueOrThrow({
        where: { id: playerCompanyId },
        select: { cashCents: true }
      }),
      prisma.inventory.findUniqueOrThrow({
        where: {
          companyId_itemId_regionId: {
            companyId: playerCompanyId,
            itemId: ironOreId,
            regionId: playerRegionId
          }
        },
        select: { quantity: true }
      })
    ]);

    const createResponse = await request(app.getHttpServer())
      .post("/v1/shipments")
      .send({
        companyId: playerCompanyId,
        toRegionId: industrialRegionId,
        itemId: ironOreId,
        quantity
      })
      .expect(201);

    const shipmentId = createResponse.body.id as string;

    await request(app.getHttpServer()).post(`/v1/shipments/${shipmentId}/cancel`).expect(200);
    await request(app.getHttpServer()).post(`/v1/shipments/${shipmentId}/cancel`).expect(200);

    const [companyAfter, sourceAfter, shipmentAfter] = await Promise.all([
      prisma.company.findUniqueOrThrow({
        where: { id: playerCompanyId },
        select: { cashCents: true }
      }),
      prisma.inventory.findUniqueOrThrow({
        where: {
          companyId_itemId_regionId: {
            companyId: playerCompanyId,
            itemId: ironOreId,
            regionId: playerRegionId
          }
        },
        select: { quantity: true }
      }),
      prisma.shipment.findUniqueOrThrow({
        where: { id: shipmentId },
        select: { status: true, tickClosed: true }
      })
    ]);

    expect(shipmentAfter.status).toBe("CANCELLED");
    expect(shipmentAfter.tickClosed).toBe(0);
    expect(sourceAfter.quantity).toBe(sourceBefore.quantity);
    expect(companyAfter.cashCents).toBe(companyBefore.cashCents - expectedFee);
  });

  it("enforces ownership with 403", async () => {
    await request(app.getHttpServer())
      .post("/v1/shipments")
      .set("X-Player-Handle", "SECOND")
      .send({
        companyId: playerCompanyId,
        toRegionId: industrialRegionId,
        itemId: ironOreId,
        quantity: 1
      })
      .expect(403);
  });

  it("lists configured regions", async () => {
    const response = await request(app.getHttpServer()).get("/v1/regions").expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThanOrEqual(3);
    expect(
      response.body.some((region: { code: string }) => region.code === "CORE")
    ).toBe(true);
  });
});
