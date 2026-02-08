import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ContractStatus } from "@prisma/client";
import { seedWorld } from "../../../packages/db/src/seed-world";
import { HttpErrorFilter } from "../src/common/filters/http-error.filter";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("contracts API integration", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let playerCompanyId: string;
  let botBuyerCompanyId: string;
  let botSellerCompanyId: string;
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
    botBuyerCompanyId = seeded.companyIds.botTrader;
    botSellerCompanyId = seeded.companyIds.botMiner;
    ironOreId = seeded.itemIds.ironOre;
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 403 when accepting with company not owned by current player", async () => {
    const contract = await prisma.contract.create({
      data: {
        buyerCompanyId: botBuyerCompanyId,
        itemId: ironOreId,
        quantity: 5,
        remainingQuantity: 5,
        priceCents: 100n,
        status: ContractStatus.OPEN,
        tickCreated: 0,
        tickExpires: 20
      }
    });

    await request(app.getHttpServer())
      .post(`/v1/contracts/${contract.id}/accept`)
      .send({
        sellerCompanyId: botSellerCompanyId
      })
      .expect(403);
  });

  it("fulfills accepted contract and transfers cash/inventory with ledger logging", async () => {
    const contract = await prisma.contract.create({
      data: {
        buyerCompanyId: botBuyerCompanyId,
        itemId: ironOreId,
        quantity: 6,
        remainingQuantity: 6,
        priceCents: 120n,
        status: ContractStatus.OPEN,
        tickCreated: 0,
        tickExpires: 40
      }
    });

    await request(app.getHttpServer())
      .post(`/v1/contracts/${contract.id}/accept`)
      .send({
        sellerCompanyId: playerCompanyId
      })
      .expect(201);

    const [sellerBefore, buyerBefore, sellerInventoryBefore, buyerInventoryBefore] =
      await Promise.all([
        prisma.company.findUniqueOrThrow({
          where: { id: playerCompanyId },
          select: { cashCents: true }
        }),
        prisma.company.findUniqueOrThrow({
          where: { id: botBuyerCompanyId },
          select: { cashCents: true }
        }),
        prisma.inventory.findUniqueOrThrow({
          where: {
            companyId_itemId: {
              companyId: playerCompanyId,
              itemId: ironOreId
            }
          },
          select: { quantity: true, reservedQuantity: true }
        }),
        prisma.inventory.findUnique({
          where: {
            companyId_itemId: {
              companyId: botBuyerCompanyId,
              itemId: ironOreId
            }
          },
          select: { quantity: true }
        })
      ]);

    const response = await request(app.getHttpServer())
      .post(`/v1/contracts/${contract.id}/fulfill`)
      .send({
        sellerCompanyId: playerCompanyId,
        quantity: 4
      })
      .expect(200);

    expect(response.body).toMatchObject({
      contract: {
        id: contract.id,
        status: "PARTIALLY_FULFILLED",
        quantity: 6,
        remainingQuantity: 2
      },
      fulfillment: {
        id: expect.any(String),
        contractId: contract.id,
        sellerCompanyId: playerCompanyId,
        itemId: ironOreId,
        quantity: 4,
        priceCents: "120"
      }
    });

    const notional = 120n * 4n;
    const [sellerAfter, buyerAfter, sellerInventoryAfter, buyerInventoryAfter] = await Promise.all([
      prisma.company.findUniqueOrThrow({
        where: { id: playerCompanyId },
        select: { cashCents: true }
      }),
      prisma.company.findUniqueOrThrow({
        where: { id: botBuyerCompanyId },
        select: { cashCents: true }
      }),
      prisma.inventory.findUniqueOrThrow({
        where: {
          companyId_itemId: {
            companyId: playerCompanyId,
            itemId: ironOreId
          }
        },
        select: { quantity: true, reservedQuantity: true }
      }),
      prisma.inventory.findUniqueOrThrow({
        where: {
          companyId_itemId: {
            companyId: botBuyerCompanyId,
            itemId: ironOreId
          }
        },
        select: { quantity: true }
      })
    ]);

    expect(sellerAfter.cashCents).toBe(sellerBefore.cashCents + notional);
    expect(buyerAfter.cashCents).toBe(buyerBefore.cashCents - notional);

    expect(sellerInventoryAfter.reservedQuantity).toBe(sellerInventoryBefore.reservedQuantity);
    expect(sellerInventoryAfter.quantity).toBe(sellerInventoryBefore.quantity - 4);
    expect(buyerInventoryAfter.quantity).toBe((buyerInventoryBefore?.quantity ?? 0) + 4);

    const fulfillment = await prisma.contractFulfillment.findFirst({
      where: {
        contractId: contract.id,
        sellerCompanyId: playerCompanyId
      }
    });
    expect(fulfillment).not.toBeNull();

    const settlementLedger = await prisma.ledgerEntry.findMany({
      where: {
        referenceId: fulfillment?.id ?? ""
      }
    });
    expect(settlementLedger.length).toBe(2);
    expect(settlementLedger.every((entry) => entry.entryType === "CONTRACT_SETTLEMENT")).toBe(
      true
    );
  });

  it("rejects over-fulfillment with 400", async () => {
    const contract = await prisma.contract.create({
      data: {
        buyerCompanyId: botBuyerCompanyId,
        sellerCompanyId: playerCompanyId,
        itemId: ironOreId,
        quantity: 3,
        remainingQuantity: 3,
        priceCents: 120n,
        status: ContractStatus.ACCEPTED,
        tickCreated: 0,
        tickExpires: 30,
        tickAccepted: 0
      }
    });

    await request(app.getHttpServer())
      .post(`/v1/contracts/${contract.id}/fulfill`)
      .send({
        sellerCompanyId: playerCompanyId,
        quantity: 4
      })
      .expect(400);
  });

  it("rejects accepting expired contracts with 400", async () => {
    const contract = await prisma.contract.create({
      data: {
        buyerCompanyId: botBuyerCompanyId,
        itemId: ironOreId,
        quantity: 4,
        remainingQuantity: 4,
        priceCents: 90n,
        status: ContractStatus.OPEN,
        tickCreated: 0,
        tickExpires: 0
      }
    });

    await request(app.getHttpServer())
      .post(`/v1/contracts/${contract.id}/accept`)
      .send({
        sellerCompanyId: playerCompanyId
      })
      .expect(400);
  });
});
