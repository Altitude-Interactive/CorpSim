import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedWorld } from "../../../packages/db/src/seed-world";
import { HttpErrorFilter } from "../src/common/filters/http-error.filter";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("production API integration", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let playerCompanyId: string;
  let ironOreId: string;
  let ironIngotId: string;
  let smeltRecipeId: string;

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
    ironIngotId = seeded.itemIds.ironIngot;

    const smeltRecipe = await prisma.recipe.findUniqueOrThrow({
      where: { code: "SMELT_IRON" },
      select: { id: true }
    });
    smeltRecipeId = smeltRecipe.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates production job, advances ticks, and completes with inventory + ledger updates", async () => {
    const beforeOre = await prisma.inventory.findUniqueOrThrow({
      where: {
        companyId_itemId: {
          companyId: playerCompanyId,
          itemId: ironOreId
        }
      },
      select: { quantity: true, reservedQuantity: true }
    });
    const beforeIngots = await prisma.inventory.findUniqueOrThrow({
      where: {
        companyId_itemId: {
          companyId: playerCompanyId,
          itemId: ironIngotId
        }
      },
      select: { quantity: true }
    });

    const createResponse = await request(app.getHttpServer())
      .post("/v1/production/jobs")
      .send({
        companyId: playerCompanyId,
        recipeId: smeltRecipeId,
        quantity: 3
      })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      id: expect.any(String),
      companyId: playerCompanyId,
      recipeId: smeltRecipeId,
      status: "RUNNING",
      quantity: 3,
      tickStarted: 0,
      tickCompletionExpected: 2
    });

    const jobId = createResponse.body.id as string;

    const reservedAfterCreate = await prisma.inventory.findUniqueOrThrow({
      where: {
        companyId_itemId: {
          companyId: playerCompanyId,
          itemId: ironOreId
        }
      },
      select: { quantity: true, reservedQuantity: true }
    });

    expect(reservedAfterCreate.quantity).toBe(beforeOre.quantity);
    expect(reservedAfterCreate.reservedQuantity).toBe(beforeOre.reservedQuantity + 6);

    await request(app.getHttpServer()).post("/v1/world/advance").send({ ticks: 1 }).expect(201);

    const runningJobsResponse = await request(app.getHttpServer())
      .get(`/v1/production/jobs?companyId=${playerCompanyId}&status=RUNNING&limit=100`)
      .expect(200);
    expect(
      runningJobsResponse.body.some((job: { id: string }) => job.id === jobId)
    ).toBe(true);

    await request(app.getHttpServer()).post("/v1/world/advance").send({ ticks: 1 }).expect(201);

    const completedJobsResponse = await request(app.getHttpServer())
      .get(`/v1/production/jobs?companyId=${playerCompanyId}&status=COMPLETED&limit=100`)
      .expect(200);
    const completedJob = completedJobsResponse.body.find(
      (job: { id: string }) => job.id === jobId
    );

    expect(completedJob).toBeDefined();
    expect(completedJob.status).toBe("COMPLETED");
    expect(completedJob.tickCompleted).toBe(2);

    const afterOre = await prisma.inventory.findUniqueOrThrow({
      where: {
        companyId_itemId: {
          companyId: playerCompanyId,
          itemId: ironOreId
        }
      },
      select: { quantity: true, reservedQuantity: true }
    });
    const afterIngots = await prisma.inventory.findUniqueOrThrow({
      where: {
        companyId_itemId: {
          companyId: playerCompanyId,
          itemId: ironIngotId
        }
      },
      select: { quantity: true }
    });

    expect(afterOre.quantity).toBe(beforeOre.quantity - 6);
    expect(afterOre.reservedQuantity).toBe(beforeOre.reservedQuantity);
    expect(afterIngots.quantity).toBe(beforeIngots.quantity + 3);

    const completionLedger = await prisma.ledgerEntry.findFirst({
      where: {
        companyId: playerCompanyId,
        referenceId: jobId,
        referenceType: "PRODUCTION_JOB_COMPLETION"
      }
    });

    expect(completionLedger).not.toBeNull();
    expect(completionLedger?.entryType).toBe("PRODUCTION_COMPLETION");
    expect(completionLedger?.deltaCashCents).toBe(0n);
    expect(completionLedger?.deltaReservedCashCents).toBe(0n);
  });

  it("cancels production jobs and releases reserved inputs idempotently", async () => {
    const beforeOre = await prisma.inventory.findUniqueOrThrow({
      where: {
        companyId_itemId: {
          companyId: playerCompanyId,
          itemId: ironOreId
        }
      },
      select: { quantity: true, reservedQuantity: true }
    });

    const createResponse = await request(app.getHttpServer())
      .post("/v1/production/jobs")
      .send({
        companyId: playerCompanyId,
        recipeId: smeltRecipeId,
        quantity: 2
      })
      .expect(201);

    const jobId = createResponse.body.id as string;

    const reservedAfterCreate = await prisma.inventory.findUniqueOrThrow({
      where: {
        companyId_itemId: {
          companyId: playerCompanyId,
          itemId: ironOreId
        }
      },
      select: { quantity: true, reservedQuantity: true }
    });

    expect(reservedAfterCreate.quantity).toBe(beforeOre.quantity);
    expect(reservedAfterCreate.reservedQuantity).toBe(beforeOre.reservedQuantity + 4);

    const cancelResponse = await request(app.getHttpServer())
      .post(`/v1/production/jobs/${jobId}/cancel`)
      .expect(200);

    expect(cancelResponse.body.status).toBe("CANCELLED");

    const afterCancel = await prisma.inventory.findUniqueOrThrow({
      where: {
        companyId_itemId: {
          companyId: playerCompanyId,
          itemId: ironOreId
        }
      },
      select: { quantity: true, reservedQuantity: true }
    });

    expect(afterCancel.quantity).toBe(beforeOre.quantity);
    expect(afterCancel.reservedQuantity).toBe(beforeOre.reservedQuantity);

    const secondCancelResponse = await request(app.getHttpServer())
      .post(`/v1/production/jobs/${jobId}/cancel`)
      .expect(200);

    expect(secondCancelResponse.body.status).toBe("CANCELLED");

    const afterSecondCancel = await prisma.inventory.findUniqueOrThrow({
      where: {
        companyId_itemId: {
          companyId: playerCompanyId,
          itemId: ironOreId
        }
      },
      select: { quantity: true, reservedQuantity: true }
    });

    expect(afterSecondCancel).toEqual(afterCancel);
  });

  it("filters production jobs by company and status", async () => {
    const cancelledJob = await request(app.getHttpServer())
      .post("/v1/production/jobs")
      .send({
        companyId: playerCompanyId,
        recipeId: smeltRecipeId,
        quantity: 1
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/production/jobs/${cancelledJob.body.id as string}/cancel`)
      .expect(200);

    await request(app.getHttpServer())
      .post("/v1/production/jobs")
      .send({
        companyId: playerCompanyId,
        recipeId: smeltRecipeId,
        quantity: 1
      })
      .expect(201);

    const cancelledResponse = await request(app.getHttpServer())
      .get(`/v1/production/jobs?companyId=${playerCompanyId}&status=CANCELLED&limit=50`)
      .expect(200);

    expect(cancelledResponse.body.length).toBeGreaterThan(0);
    expect(
      cancelledResponse.body.every((job: { status: string }) => job.status === "CANCELLED")
    ).toBe(true);

    const runningResponse = await request(app.getHttpServer())
      .get(`/v1/production/jobs?companyId=${playerCompanyId}&status=RUNNING&limit=50`)
      .expect(200);

    expect(runningResponse.body.length).toBeGreaterThan(0);
    expect(
      runningResponse.body.every((job: { status: string }) => job.status === "RUNNING")
    ).toBe(true);
  });
});
