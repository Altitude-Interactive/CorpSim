import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedWorld } from "@corpsim/db";
import { getIconCatalogItemByCode } from "@corpsim/shared";
import { HttpErrorFilter } from "../src/common/filters/http-error.filter";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("market write API integration", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let playerCompanyId: string;
  let playerRegionId: string;
  let industrialRegionId: string;
  let ironOreId: string;
  let tierTwoIconItemId: string;

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
    industrialRegionId = (
      await prisma.region.findUniqueOrThrow({
        where: { code: "INDUSTRIAL" },
        select: { id: true }
      })
    ).id;

    const iconItems = await prisma.item.findMany({
      where: {
        code: {
          startsWith: "CP_"
        }
      },
      orderBy: [{ code: "asc" }],
      select: {
        id: true,
        code: true
      }
    });
    const tierTwoIconItem = iconItems.find(
      (item) => getIconCatalogItemByCode(item.code)?.tier === 2
    );
    if (!tierTwoIconItem) {
      throw new Error("tier-2 icon item not found in seeded dataset");
    }
    tierTwoIconItemId = tierTwoIconItem.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("places BUY order and reserves cash with ledger entry", async () => {
    const reserveAmount = 150 * 4;
    const beforeCompany = await prisma.company.findUniqueOrThrow({
      where: { id: playerCompanyId },
      select: { reservedCashCents: true, cashCents: true }
    });

    const response = await request(app.getHttpServer())
      .post("/v1/market/orders")
      .send({
        companyId: playerCompanyId,
        itemId: ironOreId,
        side: "BUY",
        priceCents: 150,
        quantity: 4
      })
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      companyId: playerCompanyId,
      itemId: ironOreId,
      side: "BUY",
      regionId: playerRegionId,
      status: "OPEN",
      quantity: 4,
      remainingQuantity: 4,
      priceCents: "150",
      reservedCashCents: reserveAmount.toString(),
      reservedQuantity: 0
    });

    const afterCompany = await prisma.company.findUniqueOrThrow({
      where: { id: playerCompanyId },
      select: { reservedCashCents: true, cashCents: true }
    });

    expect(afterCompany.cashCents).toBe(beforeCompany.cashCents);
    expect(afterCompany.reservedCashCents).toBe(
      beforeCompany.reservedCashCents + BigInt(reserveAmount)
    );

    const reserveLedger = await prisma.ledgerEntry.findFirst({
      where: {
        companyId: playerCompanyId,
        referenceId: response.body.id,
        referenceType: "MARKET_ORDER_BUY_RESERVE"
      }
    });

    expect(reserveLedger).not.toBeNull();
    expect(reserveLedger?.deltaCashCents).toBe(0n);
    expect(reserveLedger?.deltaReservedCashCents).toBe(BigInt(reserveAmount));
    expect(reserveLedger?.balanceAfterCents).toBe(afterCompany.cashCents);
  });

  it("fails BUY placement with 400 when funds are insufficient", async () => {
    await request(app.getHttpServer())
      .post("/v1/market/orders")
      .send({
        companyId: playerCompanyId,
        itemId: ironOreId,
        side: "BUY",
        priceCents: 1_000_000,
        quantity: 2
      })
      .expect(400);
  });

  it("rejects placing an order in another region with 403", async () => {
    await request(app.getHttpServer())
      .post("/v1/market/orders")
      .send({
        companyId: playerCompanyId,
        itemId: ironOreId,
        regionId: industrialRegionId,
        side: "BUY",
        priceCents: 100,
        quantity: 1
      })
      .expect(403);
  });

  it("rejects placing orders for tier-locked items", async () => {
    await request(app.getHttpServer())
      .post("/v1/market/orders")
      .send({
        companyId: playerCompanyId,
        itemId: tierTwoIconItemId,
        side: "BUY",
        priceCents: 100,
        quantity: 1
      })
      .expect(400);
  });

  it("places SELL order and reserves inventory", async () => {
    const beforeInventory = await prisma.inventory.findUniqueOrThrow({
      where: {
        companyId_itemId_regionId: {
          companyId: playerCompanyId,
          itemId: ironOreId,
          regionId: playerRegionId
        }
      },
      select: { reservedQuantity: true }
    });

    await request(app.getHttpServer())
      .post("/v1/market/orders")
      .send({
        companyId: playerCompanyId,
        itemId: ironOreId,
        side: "SELL",
        priceCents: 120,
        quantity: 5
      })
      .expect(201);

    const afterInventory = await prisma.inventory.findUniqueOrThrow({
      where: {
        companyId_itemId_regionId: {
          companyId: playerCompanyId,
          itemId: ironOreId,
          regionId: playerRegionId
        }
      },
      select: { reservedQuantity: true }
    });

    expect(afterInventory.reservedQuantity).toBe(beforeInventory.reservedQuantity + 5);
  });

  it("cancels BUY order, releases cash reserve, and is idempotent", async () => {
    const reserveAmount = 200 * 3;
    const companyBeforeOrder = await prisma.company.findUniqueOrThrow({
      where: { id: playerCompanyId },
      select: { cashCents: true, reservedCashCents: true }
    });
    const orderResponse = await request(app.getHttpServer())
      .post("/v1/market/orders")
      .send({
        companyId: playerCompanyId,
        itemId: ironOreId,
        side: "BUY",
        priceCents: 200,
        quantity: 3
      })
      .expect(201);

    const orderId = orderResponse.body.id as string;

    await request(app.getHttpServer()).post(`/v1/market/orders/${orderId}/cancel`).expect(200);

    const companyAfterFirstCancel = await prisma.company.findUniqueOrThrow({
      where: { id: playerCompanyId },
      select: { cashCents: true, reservedCashCents: true }
    });
    expect(companyAfterFirstCancel.cashCents).toBe(companyBeforeOrder.cashCents);
    expect(companyAfterFirstCancel.reservedCashCents).toBe(0n);

    const firstCancelLedgerCount = await prisma.ledgerEntry.count({
      where: {
        companyId: playerCompanyId,
        referenceId: orderId
      }
    });
    expect(firstCancelLedgerCount).toBe(2);

    const releaseLedger = await prisma.ledgerEntry.findFirst({
      where: {
        companyId: playerCompanyId,
        referenceId: orderId,
        referenceType: "MARKET_ORDER_BUY_RELEASE"
      }
    });
    expect(releaseLedger?.deltaCashCents).toBe(0n);
    expect(releaseLedger?.deltaReservedCashCents).toBe(-BigInt(reserveAmount));
    expect(releaseLedger?.balanceAfterCents).toBe(companyAfterFirstCancel.cashCents);

    await request(app.getHttpServer()).post(`/v1/market/orders/${orderId}/cancel`).expect(200);

    const secondCancelLedgerCount = await prisma.ledgerEntry.count({
      where: {
        companyId: playerCompanyId,
        referenceId: orderId
      }
    });
    expect(secondCancelLedgerCount).toBe(2);
  });

  it("cancels SELL order, releases inventory reserve, and is idempotent", async () => {
    const orderResponse = await request(app.getHttpServer())
      .post("/v1/market/orders")
      .send({
        companyId: playerCompanyId,
        itemId: ironOreId,
        side: "SELL",
        priceCents: 110,
        quantity: 6
      })
      .expect(201);

    const orderId = orderResponse.body.id as string;

    await request(app.getHttpServer()).post(`/v1/market/orders/${orderId}/cancel`).expect(200);

    const inventoryAfterFirstCancel = await prisma.inventory.findUniqueOrThrow({
      where: {
        companyId_itemId_regionId: {
          companyId: playerCompanyId,
          itemId: ironOreId,
          regionId: playerRegionId
        }
      },
      select: { reservedQuantity: true }
    });
    expect(inventoryAfterFirstCancel.reservedQuantity).toBe(0);

    await request(app.getHttpServer()).post(`/v1/market/orders/${orderId}/cancel`).expect(200);

    const inventoryAfterSecondCancel = await prisma.inventory.findUniqueOrThrow({
      where: {
        companyId_itemId_regionId: {
          companyId: playerCompanyId,
          itemId: ironOreId,
          regionId: playerRegionId
        }
      },
      select: { reservedQuantity: true }
    });
    expect(inventoryAfterSecondCancel.reservedQuantity).toBe(0);
  });
});

