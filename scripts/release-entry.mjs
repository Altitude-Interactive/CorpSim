#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { findRepoRoot, getUnreleasedDir, RELEASE_TYPES } from "./lib/release-plan.mjs";

function parseArgs(args) {
  const options = {
    type: "",
    area: "",
    summary: ""
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith("--type=")) {
      options.type = arg.slice("--type=".length).trim();
      continue;
    }
    if (arg === "--type") {
      options.type = (args[index + 1] ?? "").trim();
      index += 1;
      continue;
    }
    if (arg.startsWith("--area=")) {
      options.area = arg.slice("--area=".length).trim();
      continue;
    }
    if (arg === "--area") {
      options.area = (args[index + 1] ?? "").trim();
      index += 1;
      continue;
    }
    if (arg.startsWith("--summary=")) {
      options.summary = arg.slice("--summary=".length).trim();
      continue;
    }
    if (arg === "--summary") {
      options.summary = (args[index + 1] ?? "").trim();
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function usage() {
  console.log("Usage:");
  console.log('  pnpm release:entry --type patch|minor|major --area "<area>" --summary "<summary>"');
}

function normalizeType(value) {
  const normalized = value.trim().toLowerCase();
  if (!RELEASE_TYPES.includes(normalized)) {
    throw new Error(`Invalid --type value "${value}". Use patch, minor, or major.`);
  }

  return normalized;
}

function slugify(input) {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "release-entry";
}

function buildFileName(summary) {
  const now = new Date();
  const timestamp = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    String(now.getUTCHours()).padStart(2, "0"),
    String(now.getUTCMinutes()).padStart(2, "0"),
    String(now.getUTCSeconds()).padStart(2, "0")
  ].join("");

  return `${timestamp}-${slugify(summary)}.md`;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.type || !options.area || !options.summary) {
    usage();
    process.exitCode = 1;
    return;
  }

  const type = normalizeType(options.type);
  const area = options.area.trim();
  const summary = options.summary.trim();
  if (!area || !summary) {
    throw new Error("--area and --summary must be non-empty.");
  }

  const repoRoot = findRepoRoot(process.cwd());
  const unreleasedDir = getUnreleasedDir(repoRoot);
  await mkdir(unreleasedDir, { recursive: true });

  const fileName = buildFileName(summary);
  const filePath = resolve(unreleasedDir, fileName);
  const body = [
    "---",
    `type: ${type}`,
    `area: ${area}`,
    `summary: ${summary}`,
    "---",
    "",
    `- ${summary}`,
    ""
  ].join("\n");

  await writeFile(filePath, body, "utf8");
  console.log(`Created release entry: .releases/unreleased/${basename(filePath)}`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : "Failed to create release entry");
  process.exitCode = 1;
});
