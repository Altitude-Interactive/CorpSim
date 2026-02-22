#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function parseDotenv(source) {
  const output = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const withoutExport = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const eqIndex = withoutExport.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }

    const key = withoutExport.slice(0, eqIndex).trim();
    let value = withoutExport.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    output[key] = value;
  }
  return output;
}

function resolveRepoRoot() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  return resolve(scriptDir, "..");
}

function resolvePrismaCliPath(repoRoot) {
  const directPaths = [
    resolve(repoRoot, "node_modules/prisma/build/index.js"),
    resolve(repoRoot, "packages/db/node_modules/prisma/build/index.js")
  ];

  for (const path of directPaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  const pnpmDir = resolve(repoRoot, "node_modules/.pnpm");
  if (!existsSync(pnpmDir)) {
    return null;
  }

  const prismaStoreDirs = readdirSync(pnpmDir).filter((entry) => entry.startsWith("prisma@"));
  for (const entry of prismaStoreDirs) {
    const candidate = resolve(pnpmDir, entry, "node_modules/prisma/build/index.js");
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function main() {
  const repoRoot = resolveRepoRoot();
  const envPath = resolve(repoRoot, ".env");
  let envFromFile = {};
  try {
    envFromFile = parseDotenv(readFileSync(envPath, "utf8"));
  } catch {
    envFromFile = {};
  }

  const dbDir = resolve(repoRoot, "packages/db");
  const prismaCliPath = resolvePrismaCliPath(repoRoot);
  if (!prismaCliPath) {
    console.error(
      "[prisma:generate:raw] Prisma CLI is not installed. Run `pnpm install` at the repository root."
    );
    process.exit(1);
  }

  const args = [
    prismaCliPath,
    "generate",
    "--schema",
    "prisma/schema.prisma"
  ];

  const result = spawnSync(process.execPath, args, {
    cwd: dbDir,
    stdio: "inherit",
    env: {
      ...process.env,
      ...envFromFile,
      PRISMA_GENERATE_SKIP_AUTOINSTALL: "1"
    }
  });

  if (typeof result.status === "number") {
    process.exit(result.status);
  }

  process.exit(1);
}

main();
