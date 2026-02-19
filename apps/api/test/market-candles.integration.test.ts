import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedWorld } from "@corpsim/db";
import { HttpErrorFilter } from "../src/common/filters/http-error.filter";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("market candles integration", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let playerCompanyId: string;
  let sellerCompanyId: string;
  let playerId: string;
  let playerRegionId: string;
  let sellerRegionId: string;
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
      select: { ownerPlayerId: true, regionId: true }
    });

    if (!playerCompany.ownerPlayerId) {
      throw new Error("seeded player company must be owned by PLAYER");
    }
    playerId = playerCompany.ownerPlayerId;
    playerRegionId = playerCompany.regionId;

    const sellerCompany = await prisma.company.create({
      data: {
        code: "PLAYER_CANDLE_SELLER",
        name: "Player Candle Seller",
        isPlayer: true,
        ownerPlayerId: playerId,
        regionId: playerRegionId,
        cashCents: 500_000n,
        reservedCashCents: 0n
      }
    });

    sellerCompanyId = sellerCompany.id;
    sellerRegionId = sellerCompany.regionId;

    await prisma.inventory.create({
      data: {
        companyId: sellerCompanyId,
        itemId: handToolsItemId,
        regionId: sellerRegionId,
        quantity: 30,
        reservedQuantity: 0
      }
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("writes per-tick candle OHLCV from settled trades", async () => {
    await request(app.getHttpServer())
      .post("/v1/market/orders")
      .send({
        companyId: sellerCompanyId,
        itemId: handToolsItemId,
        side: "SELL",
        priceCents: 100,
        quantity: 10
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/v1/market/orders")
      .send({
        companyId: playerCompanyId,
        itemId: handToolsItemId,
        side: "BUY",
        priceCents: 120,
        quantity: 6
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/v1/world/advance")
      .send({ ticks: 1 })
      .expect(201);

    const candlesResponse = await request(app.getHttpServer())
      .get("/v1/market/candles")
      .query({
        itemId: handToolsItemId,
        regionId: playerRegionId,
        fromTick: "1",
        toTick: "1",
        limit: "200"
      })
      .expect(200);

    expect(Array.isArray(candlesResponse.body)).toBe(true);
    expect(candlesResponse.body).toHaveLength(1);
    expect(candlesResponse.body[0]).toMatchObject({
      itemId: handToolsItemId,
      regionId: playerRegionId,
      tick: 1,
      openCents: "100",
      highCents: "100",
      lowCents: "100",
      closeCents: "100",
      volumeQty: 6,
      tradeCount: 1,
      vwapCents: "100"
    });

    const summaryResponse = await request(app.getHttpServer())
      .get("/v1/market/analytics/summary")
      .query({
        itemId: handToolsItemId,
        regionId: playerRegionId,
        windowTicks: "200"
      })
      .expect(200);

    expect(summaryResponse.body).toMatchObject({
      itemId: handToolsItemId,
      regionId: playerRegionId,
      candleCount: 1,
      lastPriceCents: "100",
      highCents: "100",
      lowCents: "100",
      avgVolumeQty: 6,
      totalVolumeQty: 6,
      vwapCents: "100"
    });
    expect(summaryResponse.body.changePctBps).toBe(0);

    const candleCount = await prisma.itemTickCandle.count({
      where: {
        itemId: handToolsItemId,
        regionId: playerRegionId,
        tick: 1
      }
    });
    expect(candleCount).toBe(1);
  });
});

