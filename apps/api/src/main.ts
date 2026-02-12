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

function resolveCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) {
    throw new Error("CORS_ORIGIN environment variable is required");
  }

  const origins = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (origins.length === 0) {
    throw new Error("CORS_ORIGIN must include at least one origin");
  }

  return origins;
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    return (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const corsOrigins = resolveCorsOrigins();
  const allowLocalhost = process.env.NODE_ENV !== "production";

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (corsOrigins.includes(origin) || (allowLocalhost && isLocalhostOrigin(origin))) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin denied: ${origin}`), false);
    },
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
