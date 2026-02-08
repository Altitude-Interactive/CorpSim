import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedWorld } from "../../../packages/db/src/seed-world";
import { HttpErrorFilter } from "../src/common/filters/http-error.filter";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("market matching and settlement integration", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let playerCompanyId: string;
  let sellerCompanyId: string;
  let playerId: string;
  let handToolsItemId: string;

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
    handToolsItemId = seeded.itemIds.handTools;

    const playerCompany = await prisma.company.findUniqueOrThrow({
      where: { id: playerCompanyId },
      select: { ownerPlayerId: true }
    });

    if (!playerCompany.ownerPlayerId) {
      throw new Error("seeded player company must be owned by PLAYER");
    }
    playerId = playerCompany.ownerPlayerId;

    const sellerCompany = await prisma.company.create({
      data: {
        code: "PLAYER_SELLER",
        name: "Player Seller Co",
        isPlayer: true,
        ownerPlayerId: playerId,
        cashCents: 500_000n,
        reservedCashCents: 0n
      }
    });

    sellerCompanyId = sellerCompany.id;

    await prisma.inventory.create({
      data: {
        companyId: sellerCompanyId,
        itemId: handToolsItemId,
        quantity: 20,
        reservedQuantity: 0
      }
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("matches crossing orders during tick advance and settles balances", async () => {
    const buyerBefore = await prisma.company.findUniqueOrThrow({
      where: { id: playerCompanyId },
      select: { cashCents: true, reservedCashCents: true }
    });
    const sellerBefore = await prisma.company.findUniqueOrThrow({
      where: { id: sellerCompanyId },
      select: { cashCents: true }
    });
    const sellerInventoryBefore = await prisma.inventory.findUniqueOrThrow({
      where: {
        companyId_itemId: {
          companyId: sellerCompanyId,
          itemId: handToolsItemId
        }
      },
      select: { quantity: true, reservedQuantity: true }
    });

    const sellOrderResponse = await request(app.getHttpServer())
      .post("/v1/market/orders")
      .send({
        companyId: sellerCompanyId,
        itemId: handToolsItemId,
        side: "SELL",
        priceCents: 100,
        quantity: 10
      })
      .expect(201);

    const buyOrderResponse = await request(app.getHttpServer())
      .post("/v1/market/orders")
      .send({
        companyId: playerCompanyId,
        itemId: handToolsItemId,
        side: "BUY",
        priceCents: 120,
        quantity: 6
      })
      .expect(201);

    await request(app.getHttpServer()).post("/v1/world/advance").send({ ticks: 1 }).expect(201);

    const trade = await prisma.trade.findFirst({
      where: {
        buyOrderId: buyOrderResponse.body.id,
        sellOrderId: sellOrderResponse.body.id
      }
    });

    expect(trade).not.toBeNull();
    expect(trade?.quantity).toBe(6);
    expect(trade?.unitPriceCents).toBe(100n);
    expect(trade?.totalPriceCents).toBe(600n);
    const tradeId = trade?.id;
    expect(tradeId).toBeDefined();
    if (!tradeId) {
      throw new Error("trade id missing");
    }

    const [buyOrder, sellOrder] = await Promise.all([
      prisma.marketOrder.findUniqueOrThrow({ where: { id: buyOrderResponse.body.id } }),
      prisma.marketOrder.findUniqueOrThrow({ where: { id: sellOrderResponse.body.id } })
    ]);

    expect(buyOrder.status).toBe("FILLED");
    expect(buyOrder.remainingQuantity).toBe(0);
    expect(buyOrder.reservedCashCents).toBe(0n);
    expect(buyOrder.tickClosed).toBe(1);

    expect(sellOrder.status).toBe("OPEN");
    expect(sellOrder.remainingQuantity).toBe(4);
    expect(sellOrder.reservedQuantity).toBe(4);

    const buyerAfter = await prisma.company.findUniqueOrThrow({
      where: { id: playerCompanyId },
      select: { cashCents: true, reservedCashCents: true }
    });
    const sellerAfter = await prisma.company.findUniqueOrThrow({
      where: { id: sellerCompanyId },
      select: { cashCents: true }
    });
    const sellerInventoryAfter = await prisma.inventory.findUniqueOrThrow({
      where: {
        companyId_itemId: {
          companyId: sellerCompanyId,
          itemId: handToolsItemId
        }
      },
      select: { quantity: true, reservedQuantity: true }
    });
    const buyerInventoryAfter = await prisma.inventory.findUniqueOrThrow({
      where: {
        companyId_itemId: {
          companyId: playerCompanyId,
          itemId: handToolsItemId
        }
      },
      select: { quantity: true, reservedQuantity: true }
    });

    expect(buyerAfter.cashCents).toBe(buyerBefore.cashCents - 600n);
    expect(buyerAfter.reservedCashCents).toBe(buyerBefore.reservedCashCents);
    expect(sellerAfter.cashCents).toBe(sellerBefore.cashCents + 600n);

    expect(sellerInventoryAfter.quantity).toBe(sellerInventoryBefore.quantity - 6);
    expect(sellerInventoryAfter.reservedQuantity).toBe(sellerInventoryBefore.reservedQuantity + 4);

    expect(buyerInventoryAfter.quantity).toBe(6);
    expect(buyerInventoryAfter.reservedQuantity).toBe(0);

    const tradeLedgerRows = await prisma.ledgerEntry.findMany({
      where: {
        referenceId: tradeId
      }
    });

    const buyLedger = tradeLedgerRows.find((entry) => entry.referenceType === "MARKET_TRADE_BUY");
    const sellLedger = tradeLedgerRows.find((entry) => entry.referenceType === "MARKET_TRADE_SELL");

    expect(buyLedger).toBeDefined();
    expect(sellLedger).toBeDefined();

    expect(buyLedger?.entryType).toBe("TRADE_SETTLEMENT");
    expect(sellLedger?.entryType).toBe("TRADE_SETTLEMENT");
    expect(buyLedger?.deltaCashCents).toBe(-600n);
    expect(buyLedger?.deltaReservedCashCents).toBe(-720n);
    expect(buyLedger?.balanceAfterCents).toBe(buyerAfter.cashCents);
    expect(sellLedger?.deltaCashCents).toBe(600n);
    expect(sellLedger?.deltaReservedCashCents).toBe(0n);
    expect(sellLedger?.balanceAfterCents).toBe(sellerAfter.cashCents);
  });
});
