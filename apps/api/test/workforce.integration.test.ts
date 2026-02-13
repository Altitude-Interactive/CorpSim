import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedWorld } from "@corpsim/db";
import { HttpErrorFilter } from "../src/common/filters/http-error.filter";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("workforce API integration", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let playerCompanyId: string;
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

    const secondPlayer = await prisma.player.create({
      data: { handle: "SECOND_WORKFORCE" }
    });
    const company = await prisma.company.create({
      data: {
        code: "SECOND_WORKFORCE_CO",
        name: "Second Workforce Co",
        isPlayer: true,
        ownerPlayerId: secondPlayer.id,
        regionId: "region_core",
        cashCents: 100_000n,
        reservedCashCents: 0n
      }
    });
    otherCompanyId = company.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns workforce snapshot for owned company", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/company/workforce")
      .query({ companyId: playerCompanyId })
      .expect(200);

    expect(response.body).toMatchObject({
      companyId: playerCompanyId,
      workforceCapacity: expect.any(Number),
      workforceAllocationOpsPct: expect.any(Number),
      workforceAllocationRngPct: expect.any(Number),
      workforceAllocationLogPct: expect.any(Number),
      workforceAllocationCorpPct: expect.any(Number),
      orgEfficiencyBps: expect.any(Number),
      weeklySalaryBurnCents: expect.any(String),
      projectedModifiers: expect.any(Object),
      pendingHiringArrivals: expect.any(Array),
      updatedAt: expect.any(String)
    });
  });

  it("rejects allocation updates when percentages do not sum to 100", async () => {
    await request(app.getHttpServer())
      .post("/v1/company/workforce/allocation")
      .send({
        companyId: playerCompanyId,
        operationsPct: 40,
        researchPct: 20,
        logisticsPct: 20,
        corporatePct: 10
      })
      .expect(400);
  });

  it("creates recruitment expense immediately and applies hiring after arrival tick", async () => {
    const requestResponse = await request(app.getHttpServer())
      .post("/v1/company/workforce/capacity-change")
      .send({
        companyId: playerCompanyId,
        deltaCapacity: 4
      })
      .expect(201);

    expect(requestResponse.body).toMatchObject({
      companyId: playerCompanyId,
      deltaCapacity: 4,
      appliedImmediately: false,
      tickRequested: 0,
      tickArrives: 2
    });

    const companyAfterRequest = await prisma.company.findUniqueOrThrow({
      where: { id: playerCompanyId },
      select: {
        workforceCapacity: true,
        cashCents: true
      }
    });
    expect(companyAfterRequest.workforceCapacity).toBe(0);
    expect(companyAfterRequest.cashCents).toBe(1_166_000n);

    const recruitmentLedger = await prisma.ledgerEntry.findFirst({
      where: {
        companyId: playerCompanyId,
        entryType: "WORKFORCE_RECRUITMENT_EXPENSE"
      }
    });
    expect(recruitmentLedger).not.toBeNull();

    await request(app.getHttpServer())
      .post("/v1/world/advance")
      .send({ ticks: 2 })
      .expect(201);

    const companyAfterArrival = await prisma.company.findUniqueOrThrow({
      where: { id: playerCompanyId },
      select: {
        workforceCapacity: true
      }
    });
    expect(companyAfterArrival.workforceCapacity).toBe(4);

    const pending = await prisma.workforceCapacityDelta.findMany({
      where: {
        companyId: playerCompanyId,
        tickApplied: null
      }
    });
    expect(pending.length).toBe(0);
  });

  it("posts salary expense ledger entries each advanced tick for each company", async () => {
    await request(app.getHttpServer())
      .post("/v1/world/advance")
      .send({ ticks: 2 })
      .expect(201);

    const companiesCount = await prisma.company.count();
    const salaryEntries = await prisma.ledgerEntry.count({
      where: {
        entryType: "WORKFORCE_SALARY_EXPENSE",
        tick: {
          gte: 1,
          lte: 2
        }
      }
    });

    expect(salaryEntries).toBe(companiesCount * 2);
  });

  it("enforces ownership on workforce endpoints", async () => {
    await request(app.getHttpServer())
      .get("/v1/company/workforce")
      .query({ companyId: otherCompanyId })
      .expect(403);

    await request(app.getHttpServer())
      .post("/v1/company/workforce/capacity-change")
      .send({
        companyId: otherCompanyId,
        deltaCapacity: 2
      })
      .expect(403);
  });
});
