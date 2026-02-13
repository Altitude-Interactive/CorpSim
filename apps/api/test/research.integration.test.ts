import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedWorld } from "@corpsim/db";
import { HttpErrorFilter } from "../src/common/filters/http-error.filter";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("research API integration", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let playerCompanyId: string;
  let botCompanyId: string;
  let metalworkingNodeId: string;
  let precisionNodeId: string;
  let assembleToolsRecipeId: string;

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
    botCompanyId = seeded.companyIds.botMiner;

    const [metalworkingNode, precisionNode, assembleToolsRecipe] = await Promise.all([
      prisma.researchNode.findUniqueOrThrow({
        where: { code: "METALWORKING" },
        select: { id: true }
      }),
      prisma.researchNode.findUniqueOrThrow({
        where: { code: "PRECISION_MANUFACTURING" },
        select: { id: true }
      }),
      prisma.recipe.findUniqueOrThrow({
        where: { code: "ASSEMBLE_TOOLS" },
        select: { id: true }
      })
    ]);

    metalworkingNodeId = metalworkingNode.id;
    precisionNodeId = precisionNode.id;
    assembleToolsRecipeId = assembleToolsRecipe.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("cannot start a locked node when prerequisites are missing", async () => {
    await request(app.getHttpServer())
      .post(`/v1/research/${precisionNodeId}/start`)
      .send({
        companyId: playerCompanyId
      })
      .expect(400);
  });

  it("forbids research mutations for companies not owned by current player", async () => {
    await request(app.getHttpServer())
      .post(`/v1/research/${metalworkingNodeId}/start`)
      .send({
        companyId: botCompanyId
      })
      .expect(403);
  });

  it("rejects production when recipe is still locked", async () => {
    await request(app.getHttpServer())
      .post("/v1/production/jobs")
      .send({
        companyId: playerCompanyId,
        recipeId: assembleToolsRecipeId,
        quantity: 1
      })
      .expect(400);
  });

  it("allows production after research completes and unlocks the recipe", async () => {
    const companyBefore = await prisma.company.findUniqueOrThrow({
      where: { id: playerCompanyId },
      select: { cashCents: true }
    });

    const start = await request(app.getHttpServer())
      .post(`/v1/research/${metalworkingNodeId}/start`)
      .send({
        companyId: playerCompanyId
      })
      .expect(201);

    expect(start.body).toMatchObject({
      companyId: playerCompanyId,
      nodeId: metalworkingNodeId,
      status: "RUNNING"
    });

    const node = await prisma.researchNode.findUniqueOrThrow({
      where: { id: metalworkingNodeId },
      select: { costCashCents: true, durationTicks: true }
    });

    const companyAfterStart = await prisma.company.findUniqueOrThrow({
      where: { id: playerCompanyId },
      select: { cashCents: true }
    });
    expect(companyAfterStart.cashCents).toBe(companyBefore.cashCents - node.costCashCents);

    const paymentLedger = await prisma.ledgerEntry.findFirst({
      where: {
        companyId: playerCompanyId,
        entryType: "RESEARCH_PAYMENT",
        referenceType: "RESEARCH_NODE",
        referenceId: metalworkingNodeId
      }
    });
    expect(paymentLedger).not.toBeNull();

    await request(app.getHttpServer())
      .post("/v1/world/advance")
      .send({ ticks: node.durationTicks })
      .expect(201);

    const unlocked = await prisma.companyRecipe.findUniqueOrThrow({
      where: {
        companyId_recipeId: {
          companyId: playerCompanyId,
          recipeId: assembleToolsRecipeId
        }
      },
      select: { isUnlocked: true }
    });
    expect(unlocked.isUnlocked).toBe(true);

    await request(app.getHttpServer())
      .post("/v1/production/jobs")
      .send({
        companyId: playerCompanyId,
        recipeId: assembleToolsRecipeId,
        quantity: 1
      })
      .expect(201);
  });
});

