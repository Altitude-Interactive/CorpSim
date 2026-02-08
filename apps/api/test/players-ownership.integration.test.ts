import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedWorld } from "../../../packages/db/src/seed-world";
import { HttpErrorFilter } from "../src/common/filters/http-error.filter";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("players ownership integration", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let playerCompanyId: string;
  let botCompanyId: string;
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
    botCompanyId = seeded.companyIds.botTrader;
    ironOreId = seeded.itemIds.ironOre;

    const secondPlayer = await prisma.player.create({
      data: {
        handle: "SECOND"
      }
    });

    await prisma.company.create({
      data: {
        code: "SECOND_CO",
        name: "Second Player Co",
        isPlayer: true,
        ownerPlayerId: secondPlayer.id,
        cashCents: 250_000n,
        reservedCashCents: 0n
      }
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns current player and only owned companies", async () => {
    const meResponse = await request(app.getHttpServer())
      .get("/v1/players/me")
      .expect(200);

    expect(meResponse.body).toMatchObject({
      id: expect.any(String),
      handle: "PLAYER"
    });

    const companiesResponse = await request(app.getHttpServer())
      .get("/v1/players/me/companies")
      .expect(200);

    expect(Array.isArray(companiesResponse.body)).toBe(true);
    expect(companiesResponse.body.length).toBe(1);
    expect(companiesResponse.body[0]).toMatchObject({
      id: playerCompanyId,
      code: "PLAYER_CO"
    });
  });

  it("returns 403 when accessing unowned company resources", async () => {
    await request(app.getHttpServer())
      .get(`/v1/companies/${botCompanyId}/inventory`)
      .expect(403);

    await request(app.getHttpServer())
      .post("/v1/market/orders")
      .send({
        companyId: botCompanyId,
        itemId: ironOreId,
        side: "SELL",
        priceCents: 100,
        quantity: 1
      })
      .expect(403);

    const recipe = await prisma.recipe.findUniqueOrThrow({
      where: { code: "SMELT_IRON" },
      select: { id: true }
    });

    await request(app.getHttpServer())
      .post("/v1/production/jobs")
      .send({
        companyId: botCompanyId,
        recipeId: recipe.id,
        quantity: 1
      })
      .expect(403);
  });
});
