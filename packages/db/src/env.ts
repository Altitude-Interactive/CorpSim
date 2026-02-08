import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

let loaded = false;

function findEnvPath(): string | undefined {
  const currentDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
  const candidates = [
    process.env.DOTENV_PATH,
    resolve(process.cwd(), ".env"),
    resolve(currentDir, "../.env"),
    resolve(currentDir, "../../../.env")
  ].filter((entry): entry is string => Boolean(entry));

  return candidates.find((entry) => existsSync(entry));
}

export function ensureEnvironmentLoaded(): void {
  if (loaded) {
    return;
  }

  if (process.env.DATABASE_URL) {
    loaded = true;
    return;
  }

  const envPath = findEnvPath();

  if (envPath) {
    config({ path: envPath });
  }

  loaded = true;
}
