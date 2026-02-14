#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_RETRIES = 6;
const BASE_DELAY_MS = 300;

function toPosixPath(value) {
  return value.replace(/\\/g, "/");
}

function findRepoRoot(startDir) {
  let current = resolve(startDir);
  for (;;) {
    if (existsSync(resolve(current, "pnpm-workspace.yaml"))) {
      return current;
    }

    const parent = resolve(current, "..");
    if (parent === current) {
      return startDir;
    }
    current = parent;
  }
}

async function readJsonFile(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

async function computeFingerprint(repoRoot) {
  const schemaPath = resolve(repoRoot, "packages/db/prisma/schema.prisma");
  const workspacePackageJsonPath = resolve(repoRoot, "package.json");
  const dbPackageJsonPath = resolve(repoRoot, "packages/db/package.json");
  const lockfilePath = resolve(repoRoot, "pnpm-lock.yaml");

  const [schemaContent, workspacePkg, dbPkg, lockContent] = await Promise.all([
    readFile(schemaPath, "utf8"),
    readJsonFile(workspacePackageJsonPath),
    readJsonFile(dbPackageJsonPath),
    readFile(lockfilePath, "utf8")
  ]);

  const prismaVersion =
    workspacePkg?.devDependencies?.prisma ??
    workspacePkg?.dependencies?.prisma ??
    "unknown";
  const prismaClientVersion =
    dbPkg?.dependencies?.["@prisma/client"] ??
    workspacePkg?.dependencies?.["@prisma/client"] ??
    "unknown";

  const fingerprint = createHash("sha256")
    .update(schemaContent)
    .update("\n")
    .update(String(prismaVersion))
    .update("\n")
    .update(String(prismaClientVersion))
    .update("\n")
    .update(lockContent)
    .digest("hex");

  return {
    fingerprint,
    schemaContent
  };
}

function resolvePrismaGeneratedClientDir(repoRoot) {
  const prismaClientPackageJsonPath = resolve(
    repoRoot,
    "node_modules/@prisma/client/package.json"
  );
  if (!existsSync(prismaClientPackageJsonPath)) {
    return undefined;
  }

  const realPackageJsonPath = realpathSync(prismaClientPackageJsonPath);
  const pnpmNodeModulesPath = resolve(realPackageJsonPath, "..", "..", "..");
  return resolve(pnpmNodeModulesPath, ".prisma", "client");
}

function getGeneratedClientSentinelPath(repoRoot) {
  const generatedClientDir = resolvePrismaGeneratedClientDir(repoRoot);
  if (!generatedClientDir) {
    return undefined;
  }

  return resolve(generatedClientDir, "index.js");
}

function getGeneratedSchemaPath(repoRoot) {
  const generatedClientDir = resolvePrismaGeneratedClientDir(repoRoot);
  if (!generatedClientDir) {
    return undefined;
  }

  return resolve(generatedClientDir, "schema.prisma");
}

function isLikelyWindowsEngineRenameLock(outputText) {
  const normalized = outputText.toLowerCase();
  return (
    normalized.includes("eperm: operation not permitted, rename") &&
    normalized.includes("query_engine-windows.dll.node")
  );
}

function sleepMs(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

function normalizeNewlines(value) {
  return value.replace(/\r\n/g, "\n");
}

function canonicalizePrismaSchema(value) {
  return normalizeNewlines(value)
    .replace(/^\s*\/\/\/.*$/gm, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasGeneratedQueryEngineBinary(repoRoot) {
  const generatedClientDir = resolvePrismaGeneratedClientDir(repoRoot);
  if (!generatedClientDir || !existsSync(generatedClientDir)) {
    return false;
  }

  try {
    return readdirSync(generatedClientDir).some((entry) => /^query_engine-.*\.node$/i.test(entry));
  } catch {
    return false;
  }
}

function hasGeneratedLibraryEngine(repoRoot) {
  const generatedClientDir = resolvePrismaGeneratedClientDir(repoRoot);
  if (!generatedClientDir) {
    return false;
  }

  const defaultClientPath = resolve(generatedClientDir, "default.js");
  if (!existsSync(defaultClientPath)) {
    return false;
  }

  try {
    const defaultClientSource = readFileSync(defaultClientPath, "utf8");
    return /engineType\s*:\s*['"]library['"]/i.test(defaultClientSource);
  } catch {
    return false;
  }
}

function hasUsableGeneratedClient(repoRoot) {
  return hasGeneratedQueryEngineBinary(repoRoot) && hasGeneratedLibraryEngine(repoRoot);
}

async function canUseExistingGeneratedClient(repoRoot, schemaContent) {
  const generatedClientDir = resolvePrismaGeneratedClientDir(repoRoot);
  const sentinelPath = getGeneratedClientSentinelPath(repoRoot);
  const generatedSchemaPath = getGeneratedSchemaPath(repoRoot);
  if (
    !generatedClientDir ||
    !sentinelPath ||
    !generatedSchemaPath ||
    !existsSync(sentinelPath) ||
    !existsSync(generatedSchemaPath)
  ) {
    return false;
  }

  try {
    const generatedSchemaContent = await readFile(generatedSchemaPath, "utf8");
    return (
      canonicalizePrismaSchema(generatedSchemaContent) ===
      canonicalizePrismaSchema(schemaContent) &&
      hasUsableGeneratedClient(repoRoot)
    );
  } catch {
    return false;
  }
}

function runGenerateOnce(repoRoot) {
  const args = ["--dir", toPosixPath(resolve(repoRoot, "packages/db")), "run", "generate:raw"];
  return spawnSync("pnpm", args, {
    cwd: repoRoot,
    stdio: "pipe",
    encoding: "utf8",
    shell: process.platform === "win32"
  });
}

function flushProcessOutput(result) {
  if (typeof result.stdout === "string" && result.stdout.length > 0) {
    process.stdout.write(result.stdout);
  }
  if (typeof result.stderr === "string" && result.stderr.length > 0) {
    process.stderr.write(result.stderr);
  }
}

async function runGenerateWithRetry(repoRoot, schemaContent) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const result = runGenerateOnce(repoRoot);
    if (result.status === 0) {
      flushProcessOutput(result);
      return;
    }

    const statusText = String(result.status ?? "unknown");
    const signalText = result.signal ?? "";
    const stderrText = String(result.stderr ?? "");
    const stdoutText = String(result.stdout ?? "");
    const combined = `${stdoutText}\n${stderrText}\n${statusText}\n${signalText}`;
    const isWindowsLock = isLikelyWindowsEngineRenameLock(combined);

    if (!isWindowsLock || attempt === MAX_RETRIES) {
      if (isWindowsLock) {
        const canReuse = await canUseExistingGeneratedClient(repoRoot, schemaContent);
        if (canReuse) {
          console.warn(
            "[prisma:generate] generate could not replace Windows engine files after retries; using existing compatible Prisma client"
          );
          return;
        }
      }

      flushProcessOutput(result);
      process.exit(result.status ?? 1);
    }

    const delayMs = BASE_DELAY_MS * 2 ** (attempt - 1);
    console.warn(
      `[prisma:generate] Windows engine file is locked (attempt ${attempt}/${MAX_RETRIES}); retrying in ${delayMs}ms`
    );
    await sleepMs(delayMs);
  }
}

async function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = findRepoRoot(resolve(scriptDir, ".."));
  const forceGenerate = process.env.PRISMA_GENERATE_FORCE === "1";
  const statePath = resolve(repoRoot, ".corpsim/cache/prisma-generate-state.json");
  const { fingerprint, schemaContent } = await computeFingerprint(repoRoot);
  const sentinelPath = getGeneratedClientSentinelPath(repoRoot);
  const generatedSchemaPath = getGeneratedSchemaPath(repoRoot);

  if (!forceGenerate && sentinelPath && existsSync(sentinelPath) && existsSync(statePath)) {
    try {
      const stateRaw = await readFile(statePath, "utf8");
      const state = JSON.parse(stateRaw);
      if (state?.fingerprint === fingerprint && hasUsableGeneratedClient(repoRoot)) {
        console.log("[prisma:generate] schema unchanged; skipping generate");
        return;
      }
    } catch {
      // Ignore state parse/read errors and regenerate.
    }
  }

  if (!forceGenerate && generatedSchemaPath && existsSync(generatedSchemaPath)) {
    try {
      const generatedSchemaContent = await readFile(generatedSchemaPath, "utf8");
      if (
        canonicalizePrismaSchema(generatedSchemaContent) ===
        canonicalizePrismaSchema(schemaContent) &&
        hasUsableGeneratedClient(repoRoot)
      ) {
        console.log("[prisma:generate] generated client already matches schema; skipping generate");
        await mkdir(dirname(statePath), { recursive: true });
        await writeFile(
          statePath,
          JSON.stringify(
            {
              fingerprint,
              generatedAt: new Date().toISOString()
            },
            null,
            2
          ) + "\n",
          "utf8"
        );
        return;
      }
    } catch {
      // If we cannot read generated schema, continue with normal generate flow.
    }
  }

  await runGenerateWithRetry(repoRoot, schemaContent);

  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(
    statePath,
    JSON.stringify(
      {
        fingerprint,
        generatedAt: new Date().toISOString()
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
}

main().catch((error) => {
  console.error("[prisma:generate] failed", error);
  process.exit(1);
});
