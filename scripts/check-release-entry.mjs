#!/usr/bin/env node

import { execFileSync } from "node:child_process";

function readChangedFiles(baseSha, headSha) {
  if (!baseSha || !headSha) {
    return execFileSync("git", ["diff", "--name-only", "--diff-filter=ACMRTUXB", "HEAD~1", "HEAD"], {
      encoding: "utf8"
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return execFileSync(
    "git",
    ["diff", "--name-only", "--diff-filter=ACMRTUXB", baseSha, headSha],
    {
      encoding: "utf8"
    }
  )
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isReleaseEntryPath(filePath) {
  return filePath.startsWith(".releases/unreleased/") && filePath.endsWith(".md");
}

function isDocsOnlyPath(filePath) {
  if (isReleaseEntryPath(filePath)) {
    return true;
  }

  return filePath.startsWith("docs/") || filePath.toLowerCase().endsWith(".md");
}

function shouldEnforceReleaseEntry(changedFiles) {
  return changedFiles.some((filePath) => !isDocsOnlyPath(filePath));
}

function run() {
  const baseSha = process.env.BASE_SHA?.trim();
  const headSha = process.env.HEAD_SHA?.trim() || process.env.GITHUB_SHA?.trim();

  const changedFiles = readChangedFiles(baseSha, headSha);
  if (changedFiles.length === 0) {
    console.log("No changed files detected; release entry check skipped.");
    return;
  }

  if (!shouldEnforceReleaseEntry(changedFiles)) {
    console.log("Docs-only change detected; release entry not required.");
    return;
  }

  const hasReleaseEntry = changedFiles.some((filePath) => isReleaseEntryPath(filePath));
  if (hasReleaseEntry) {
    console.log("Release entry check passed.");
    return;
  }

  console.error("Release entry check failed.");
  console.error(
    "Non-doc changes require a file in .releases/unreleased/*.md with type, area, and summary."
  );
  process.exitCode = 1;
}

run();
