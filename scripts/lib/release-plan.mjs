import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

export const RELEASE_TYPES = ["patch", "minor", "major"];
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---/;

export function findRepoRoot(startDir) {
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

export function getUnreleasedDir(repoRoot) {
  return resolve(repoRoot, ".releases", "unreleased");
}

function parseFrontmatter(text, filePath) {
  const match = text.match(FRONTMATTER_PATTERN);
  if (!match) {
    throw new Error(`Release entry missing frontmatter: ${filePath}`);
  }

  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const kvMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9_-]*):\s*(.+)$/);
    if (!kvMatch) {
      throw new Error(`Invalid frontmatter line in ${filePath}: "${line}"`);
    }

    metadata[kvMatch[1]] = kvMatch[2].trim();
  }

  return metadata;
}

function normalizeType(type, filePath) {
  if (typeof type !== "string") {
    throw new Error(`Release entry missing "type": ${filePath}`);
  }

  const normalized = type.trim().toLowerCase();
  if (!RELEASE_TYPES.includes(normalized)) {
    throw new Error(
      `Release entry has invalid type "${type}" in ${filePath}; use patch, minor, or major.`
    );
  }

  return normalized;
}

export async function parseReleaseEntry(filePath) {
  const text = await readFile(filePath, "utf8");
  const metadata = parseFrontmatter(text, filePath);
  const type = normalizeType(metadata.type, filePath);
  const area = typeof metadata.area === "string" ? metadata.area.trim() : "";
  const summary = typeof metadata.summary === "string" ? metadata.summary.trim() : "";

  if (!area) {
    throw new Error(`Release entry missing "area" in ${filePath}`);
  }
  if (!summary) {
    throw new Error(`Release entry missing "summary" in ${filePath}`);
  }

  return {
    filePath,
    fileName: basename(filePath),
    type,
    area,
    summary
  };
}

export async function loadUnreleasedEntries(repoRoot) {
  const dirPath = getUnreleasedDir(repoRoot);
  if (!existsSync(dirPath)) {
    return [];
  }

  const files = (await readdir(dirPath, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => resolve(dirPath, entry.name))
    .sort((left, right) => left.localeCompare(right));

  const entries = [];
  for (const filePath of files) {
    entries.push(await parseReleaseEntry(filePath));
  }

  return entries;
}
