#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TAG_PATTERN = /^v(\d+\.\d+\.\d+)$/;

function readRootVersion() {
  const raw = readFileSync(resolve(process.cwd(), "package.json"), "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || typeof parsed.version !== "string") {
    throw new Error("Root package.json version is missing or invalid.");
  }

  return parsed.version.trim();
}

function resolveTagName() {
  const fromArg = process.argv[2]?.trim();
  if (fromArg) {
    return fromArg;
  }

  const fromEnv = process.env.GITHUB_REF_NAME?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  throw new Error("Tag name is required (argument or GITHUB_REF_NAME).");
}

function assertAnnotatedTag(tagName) {
  const output = execFileSync(
    "git",
    ["for-each-ref", `refs/tags/${tagName}`, "--format=%(objecttype)"],
    { encoding: "utf8" }
  ).trim();

  if (!output) {
    throw new Error(`Tag ${tagName} was not found in local refs.`);
  }

  if (output !== "tag") {
    throw new Error(`Tag ${tagName} must be annotated (lightweight tags are not allowed).`);
  }
}

function run() {
  const tagName = resolveTagName();
  const match = tagName.match(TAG_PATTERN);
  if (!match) {
    throw new Error(`Invalid tag format "${tagName}". Expected vX.Y.Z.`);
  }

  assertAnnotatedTag(tagName);

  const versionFromTag = match[1];
  const packageVersion = readRootVersion();
  if (packageVersion !== versionFromTag) {
    throw new Error(
      `Tag/version mismatch: tag ${tagName} expects ${versionFromTag}, package.json has ${packageVersion}.`
    );
  }

  console.log(`Tag/version check passed: ${tagName} matches package.json (${packageVersion}).`);
}

run();
