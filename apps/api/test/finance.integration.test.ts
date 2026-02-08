import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedWorld } from "../../../packages/db/src/seed-world";
import { HttpErrorFilter } from "../src/common/filters/http-error.filter";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("finance API integration", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let playerCompanyId: string;
  let ironOreId: string;
  let otherCompanyId: string;

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

    const secondPlayer = await prisma.player.create({
      data: { handle: "SECOND" }
    });

    const otherCompany = await prisma.company.create({
      data: {
        code: "SECOND_LEDGER",
        name: "Second Ledger Co",
        isPlayer: true,
        ownerPlayerId: secondPlayer.id,
        cashCents: 100_000n,
        reservedCashCents: 0n
      }
    });
    otherCompanyId = otherCompany.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("enforces ownership with 403 on finance endpoints", async () => {
    await request(app.getHttpServer())
      .get("/v1/finance/ledger")
      .query({ companyId: otherCompanyId })
      .expect(403);

    await request(app.getHttpServer())
      .get("/v1/finance/summary")
      .query({ companyId: otherCompanyId })
      .expect(403);
  });

  it("returns stable ledger DTO payload", async () => {
    const order = await request(app.getHttpServer())
      .post("/v1/market/orders")
      .send({
        companyId: playerCompanyId,
        itemId: ironOreId,
        side: "BUY",
        priceCents: 150,
        quantity: 3
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/market/orders/${order.body.id as string}/cancel`)
      .expect(200);

    const ledger = await request(app.getHttpServer())
      .get("/v1/finance/ledger")
      .query({
        companyId: playerCompanyId,
        limit: 100
      })
      .expect(200);

    expect(ledger.body).toMatchObject({
      entries: expect.any(Array)
    });
    expect(
      ledger.body.nextCursor === null || typeof ledger.body.nextCursor === "string"
    ).toBe(true);
    expect(ledger.body.entries.length).toBeGreaterThan(0);
    expect(ledger.body.entries[0]).toMatchObject({
      id: expect.any(String),
      tick: expect.any(Number),
      entryType: expect.any(String),
      referenceType: expect.any(String),
      referenceId: expect.any(String),
      deltaCashCents: expect.any(String),
      deltaReservedCashCents: expect.any(String),
      balanceAfterCents: expect.any(String),
      createdAt: expect.any(String)
    });
  });

  it("summary totals reconcile with ledger deltas for same window", async () => {
    const firstOrder = await request(app.getHttpServer())
      .post("/v1/market/orders")
      .send({
        companyId: playerCompanyId,
        itemId: ironOreId,
        side: "BUY",
        priceCents: 200,
        quantity: 2
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/market/orders/${firstOrder.body.id as string}/cancel`)
      .expect(200);

    await request(app.getHttpServer())
      .post("/v1/market/orders")
      .send({
        companyId: playerCompanyId,
        itemId: ironOreId,
        side: "BUY",
        priceCents: 210,
        quantity: 1
      })
      .expect(201);

    const tick = await request(app.getHttpServer()).get("/v1/world/tick").expect(200);
    const toTick = tick.body.currentTick as number;
    const fromTick = Math.max(0, toTick - 100 + 1);

    const [summary, ledger] = await Promise.all([
      request(app.getHttpServer())
        .get("/v1/finance/summary")
        .query({ companyId: playerCompanyId, windowTicks: 100 })
        .expect(200),
      request(app.getHttpServer())
        .get("/v1/finance/ledger")
        .query({
          companyId: playerCompanyId,
          fromTick,
          toTick,
          limit: 500
        })
        .expect(200)
    ]);

    const entries = ledger.body.entries as Array<{
      deltaCashCents: string;
      deltaReservedCashCents: string;
    }>;
    const deltaCash = entries.reduce(
      (sum, entry) => sum + BigInt(entry.deltaCashCents),
      0n
    );
    const deltaReserved = entries.reduce(
      (sum, entry) => sum + BigInt(entry.deltaReservedCashCents),
      0n
    );

    expect(BigInt(summary.body.totalDeltaCashCents)).toBe(deltaCash);
    expect(BigInt(summary.body.totalDeltaReservedCashCents)).toBe(deltaReserved);

    const starting = BigInt(summary.body.startingCashCents);
    const ending = BigInt(summary.body.endingCashCents);
    expect(starting + BigInt(summary.body.totalDeltaCashCents)).toBe(ending);
  });
});
