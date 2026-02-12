import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { HttpErrorFilter } from "../src/common/filters/http-error.filter";

describe("meta endpoint integration", () => {
  let app: INestApplication;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns a public semantic version string", async () => {
    const response = await request(app.getHttpServer()).get("/meta/version").expect(200);

    expect(response.body).toEqual({
      version: expect.stringMatching(/^\d+\.\d+\.\d+(?:-dev\+[a-f0-9]{7})?$/)
    });
  });
});
