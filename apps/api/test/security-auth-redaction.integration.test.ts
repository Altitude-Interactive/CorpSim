import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedWorld } from "@corpsim/db";
import type { CompanySummary, PlayerRegistryEntry } from "@corpsim/shared";
import { HttpErrorFilter } from "../src/common/filters/http-error.filter";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("security: authentication and data redaction", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let playerCompanyId: string;
  let botCompanyId: string;
  let playerId: string;

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
    
    // Get player ID from the player company
    const playerCompany = await prisma.company.findUniqueOrThrow({
      where: { id: playerCompanyId },
      select: { ownerPlayerId: true }
    });
    playerId = playerCompany.ownerPlayerId!;
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /v1/companies", () => {
    it("returns 401 when not authenticated and guard is enforced", async () => {
      if (process.env.AUTH_ENFORCE_GUARD_IN_TESTS !== "true") {
        return; // Skip test if guard is not enforced in tests
      }

      const response = await request(app.getHttpServer())
        .get("/v1/companies")
        .expect(401);

      expect(response.body).toHaveProperty("message");
    });

    it("returns companies with redacted cashCents for non-owned companies", async () => {
      const response = await request(app.getHttpServer())
        .get("/v1/companies")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      const companies = response.body as CompanySummary[];
      expect(companies.length).toBeGreaterThan(1);

      // Find player-owned company
      const playerCompany = companies.find((c) => c.id === playerCompanyId);
      expect(playerCompany).toBeDefined();
      expect(playerCompany!.cashCents).toBeDefined();
      expect(typeof playerCompany!.cashCents).toBe("string");

      // Find bot company (not owned by player)
      const botCompany = companies.find((c) => c.id === botCompanyId);
      expect(botCompany).toBeDefined();
      expect(botCompany!.cashCents).toBeUndefined();
    });

    it("includes standard company fields for all companies", async () => {
      const response = await request(app.getHttpServer())
        .get("/v1/companies")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      const company = response.body[0];
      expect(company).toHaveProperty("id");
      expect(company).toHaveProperty("code");
      expect(company).toHaveProperty("name");
      expect(company).toHaveProperty("isBot");
      expect(company).toHaveProperty("specialization");
      expect(company).toHaveProperty("regionId");
      expect(company).toHaveProperty("regionCode");
      expect(company).toHaveProperty("regionName");
    });
  });

  describe("GET /v1/players/registry", () => {
    it("returns 401 when not authenticated and guard is enforced", async () => {
      if (process.env.AUTH_ENFORCE_GUARD_IN_TESTS !== "true") {
        return; // Skip test if guard is not enforced in tests
      }

      const response = await request(app.getHttpServer())
        .get("/v1/players/registry")
        .expect(401);

      expect(response.body).toHaveProperty("message");
    });

    it("returns player registry with full details for own player only", async () => {
      const response = await request(app.getHttpServer())
        .get("/v1/players/registry")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      const players = response.body as PlayerRegistryEntry[];
      
      // Find the requesting player
      const requestingPlayer = players.find((p) => p.id === playerId);
      expect(requestingPlayer).toBeDefined();
      
      // Requesting player should have full company details
      if (requestingPlayer && requestingPlayer.companies.length > 0) {
        const ownCompany = requestingPlayer.companies[0];
        expect(ownCompany.cashCents).toBeDefined();
        expect(typeof ownCompany.cashCents).toBe("string");
        expect(Array.isArray(ownCompany.itemHoldings)).toBe(true);
      }
    });

    it("redacts cashCents and itemHoldings for other players' companies", async () => {
      const response = await request(app.getHttpServer())
        .get("/v1/players/registry")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      const players = response.body as PlayerRegistryEntry[];
      
      // Find a player that is not the requesting player
      const otherPlayer = players.find((p) => p.id !== playerId);
      
      if (otherPlayer && otherPlayer.companies.length > 0) {
        const otherCompany = otherPlayer.companies[0];
        expect(otherCompany.cashCents).toBeUndefined();
        expect(Array.isArray(otherCompany.itemHoldings)).toBe(true);
        expect(otherCompany.itemHoldings.length).toBe(0);
      }
    });

    it("includes standard player and company fields", async () => {
      const response = await request(app.getHttpServer())
        .get("/v1/players/registry")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      const player = response.body[0];
      expect(player).toHaveProperty("id");
      expect(player).toHaveProperty("handle");
      expect(player).toHaveProperty("createdAt");
      expect(player).toHaveProperty("updatedAt");
      expect(Array.isArray(player.companies)).toBe(true);
      
      if (player.companies.length > 0) {
        const company = player.companies[0];
        expect(company).toHaveProperty("id");
        expect(company).toHaveProperty("code");
        expect(company).toHaveProperty("name");
        expect(company).toHaveProperty("isBot");
        expect(company).toHaveProperty("regionId");
        expect(company).toHaveProperty("regionCode");
        expect(company).toHaveProperty("regionName");
        expect(company).toHaveProperty("itemHoldings");
      }
    });

    it("does not include admin players in registry", async () => {
      // Create an admin user
      await prisma.user.create({
        data: {
          id: "admin_test",
          name: "Admin Test",
          email: "admin-test@corpsim.local",
          role: "admin"
        }
      });

      const response = await request(app.getHttpServer())
        .get("/v1/players/registry")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      const players = response.body as PlayerRegistryEntry[];
      
      // Verify no player with admin user ID is in the registry
      const adminPlayer = players.find((p) => p.id === "admin_test");
      expect(adminPlayer).toBeUndefined();
    });
  });
});
