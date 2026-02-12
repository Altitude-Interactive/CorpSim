import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const GIT_SHA_PATTERN = /^[a-f0-9]{7,40}$/i;
const FALLBACK_VERSION = "0.0.0";

function normalizeSemver(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!SEMVER_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function normalizeGitSha(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!GIT_SHA_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed.slice(0, 7).toLowerCase();
}

function resolvePackageVersion(): string {
  const packageJsonPath = resolve(findRepoRoot(process.cwd()), "package.json");
  if (!existsSync(packageJsonPath)) {
    return FALLBACK_VERSION;
  }

  try {
    const raw = readFileSync(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    const normalized = normalizeSemver(parsed.version);
    return normalized ?? FALLBACK_VERSION;
  } catch {
    return FALLBACK_VERSION;
  }
}

function findRepoRoot(startDir: string): string {
  let current = resolve(startDir);

  for (;;) {
    const hasWorkspace = existsSync(resolve(current, "pnpm-workspace.yaml"));
    const hasGitDirectory = existsSync(resolve(current, ".git"));

    if (hasWorkspace || hasGitDirectory) {
      return current;
    }

    const parent = resolve(current, "..");
    if (parent === current) {
      return startDir;
    }
    current = parent;
  }
}

const ROOT_PACKAGE_VERSION = resolvePackageVersion();

export function getAppVersion(): string {
  const configuredVersion = normalizeSemver(process.env.CORPSIM_VERSION);
  const baseVersion = configuredVersion ?? ROOT_PACKAGE_VERSION;
  const gitSha = normalizeGitSha(process.env.CORPSIM_GIT_SHA);

  if (!gitSha || process.env.NODE_ENV === "production") {
    return baseVersion;
  }

  return `${baseVersion}-dev+${gitSha}`;
}
