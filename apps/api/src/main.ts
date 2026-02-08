import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ensureEnvironmentLoaded } from "../../../packages/db/src/env";
import { AppModule } from "./app.module";
import { HttpErrorFilter } from "./common/filters/http-error.filter";

ensureEnvironmentLoaded();

function resolvePort(): number {
  const raw = process.env.PORT ?? process.env.API_PORT;

  if (!raw) {
    throw new Error("PORT or API_PORT environment variable is required");
  }

  const port = Number.parseInt(raw, 10);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid API port: ${raw}`);
  }

  return port;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const corsOrigin = process.env.CORS_ORIGIN;

  if (!corsOrigin) {
    throw new Error("CORS_ORIGIN environment variable is required");
  }

  app.enableCors({
    origin: corsOrigin,
    credentials: false
  });

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

  await app.listen(resolvePort());
}

bootstrap().catch((error: unknown) => {
  console.error("API bootstrap failed", error);
  process.exitCode = 1;
});
