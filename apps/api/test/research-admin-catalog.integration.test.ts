import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedWorld } from "@corpsim/db";
import { HttpErrorFilter } from "../src/common/filters/http-error.filter";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { ResearchService } from "../src/research/research.service";

describe("research admin catalog", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let researchService: ResearchService;

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
    researchService = app.get(ResearchService);
  });

  beforeEach(async () => {
    await seedWorld(prisma, { reset: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns a research catalog for admins without requiring player ownership", async () => {
    const result = await researchService.listResearchForAdminCatalog();

    expect(typeof result.companyId).toBe("string");
    expect(result.companyId.length).toBeGreaterThan(0);
    expect(result.nodes.length).toBeGreaterThan(0);

    const company = await prisma.company.findUniqueOrThrow({
      where: { id: result.companyId },
      select: {
        isPlayer: true,
        ownerPlayerId: true
      }
    });

    expect(company.isPlayer).toBe(true);
    expect(company.ownerPlayerId).not.toBeNull();
  });
});
