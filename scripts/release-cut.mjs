#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { findRepoRoot, loadUnreleasedEntries } from "./lib/release-plan.mjs";

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;
const BUMP_PRIORITY = {
  patch: 1,
  minor: 2,
  major: 3
};

function parseArgs(args) {
  return {
    dryRun: args.includes("--dry-run"),
    skipRemoteCheck: args.includes("--skip-remote-check")
  };
}

function parseSemver(value) {
  const match = value.match(SEMVER_PATTERN);
  if (!match) {
    throw new Error(`Invalid package version "${value}". Expected X.Y.Z.`);
  }

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10)
  };
}

function computeNextVersion(currentVersion, bumpType) {
  const parsed = parseSemver(currentVersion);

  if (bumpType === "major") {
    return `${parsed.major + 1}.0.0`;
  }
  if (bumpType === "minor") {
    return `${parsed.major}.${parsed.minor + 1}.0`;
  }

  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

function determineBumpType(entries) {
  return entries.reduce((current, entry) => {
    if (BUMP_PRIORITY[entry.type] > BUMP_PRIORITY[current]) {
      return entry.type;
    }
    return current;
  }, "patch");
}

function ensureTagIsFree(nextVersion, skipRemoteCheck) {
  const tagName = `v${nextVersion}`;

  try {
    execFileSync("git", ["rev-parse", "-q", "--verify", `refs/tags/${tagName}`], {
      stdio: "ignore"
    });
    throw new Error(`Tag ${tagName} already exists locally.`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("already exists locally")) {
      throw error;
    }
  }

  if (skipRemoteCheck) {
    return;
  }

  try {
    const output = execFileSync("git", ["ls-remote", "--tags", "origin", `refs/tags/${tagName}`], {
      encoding: "utf8"
    }).trim();
    if (output) {
      throw new Error(`Tag ${tagName} already exists on origin.`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("already exists on origin")) {
      throw error;
    }

    throw new Error(
      `Unable to verify tag ${tagName} against origin. Re-run with --skip-remote-check only if you are intentionally offline.`
    );
  }
}

const PRIORITY = { major: 0, minor: 1, patch: 2 };

function buildSection(nextVersion, entries) {
  const date = new Date().toISOString().slice(0, 10);

  const lines = [`## ${nextVersion} - ${date}`, "", "### What's Changed", ""];
  
  // Sort entries: major, then minor, then patch
  const sorted = [...entries].sort((a, b) => {
    return (PRIORITY[a.type] ?? 999) - (PRIORITY[b.type] ?? 999);
  });
  
  for (const entry of sorted) {
    lines.push(`- [${entry.area}] ${entry.summary}`);
  }
  
  lines.push("");

  return lines.join("\n").trimEnd();
}

function buildDefaultChangelogHeader() {
  return [
    "# Changelog",
    "",
    "All notable changes to CorpSim are documented in this file.",
    ""
  ].join("\n");
}

function mergeChangelog(existingContent, section) {
  const normalizedExisting = existingContent.trim();
  if (!normalizedExisting) {
    return `${buildDefaultChangelogHeader()}\n${section}\n`;
  }

  if (!normalizedExisting.startsWith("# Changelog")) {
    return `${buildDefaultChangelogHeader()}\n${section}\n\n${normalizedExisting}\n`;
  }

  const existingWithoutTrailingSpace = normalizedExisting.replace(/\s+$/, "");
  return `${existingWithoutTrailingSpace}\n\n${section}\n`;
}

async function readPackageJson(packageJsonPath) {
  const raw = await readFile(packageJsonPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || typeof parsed.version !== "string") {
    throw new Error("Root package.json is missing a valid version field.");
  }
  return parsed;
}

async function run() {
  const { dryRun, skipRemoteCheck } = parseArgs(process.argv.slice(2));
  const repoRoot = findRepoRoot(process.cwd());
  const entries = await loadUnreleasedEntries(repoRoot);

  if (entries.length === 0) {
    throw new Error("No unreleased entries found in .releases/unreleased.");
  }

  const packageJsonPath = resolve(repoRoot, "package.json");
  const packageJson = await readPackageJson(packageJsonPath);
  const bumpType = determineBumpType(entries);
  const currentVersion = packageJson.version;
  const nextVersion = computeNextVersion(currentVersion, bumpType);

  ensureTagIsFree(nextVersion, skipRemoteCheck);

  const section = buildSection(nextVersion, entries);
  const changelogPath = resolve(repoRoot, "CHANGELOG.md");
  const existingChangelog = existsSync(changelogPath) ? await readFile(changelogPath, "utf8") : "";
  const nextChangelog = mergeChangelog(existingChangelog, section);

  const archiveDir = resolve(repoRoot, ".releases", "released", `v${nextVersion}`);

  if (dryRun) {
    console.log(`Current version: ${currentVersion}`);
    console.log(`Next version: ${nextVersion}`);
    console.log(`Entries: ${entries.length}`);
    console.log(`Bump type: ${bumpType}`);
    return;
  }

  packageJson.version = nextVersion;
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
  await writeFile(changelogPath, nextChangelog, "utf8");

  await mkdir(archiveDir, { recursive: true });
  for (const entry of entries) {
    const targetPath = resolve(archiveDir, basename(entry.filePath));
    await rename(entry.filePath, targetPath);
  }

  console.log(`Release cut prepared: ${currentVersion} -> ${nextVersion}`);
  console.log(`Archived ${entries.length} entries to .releases/released/v${nextVersion}`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : "Release cut failed");
  process.exitCode = 1;
});
