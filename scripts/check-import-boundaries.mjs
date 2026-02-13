#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);

const FORBIDDEN_IMPORT_RULES = [
  {
    name: "workspace source deep import",
    pattern: /(^|[./])packages\/[A-Za-z0-9_-]+\/src(\/|$)/
  },
  {
    name: "package internal src deep import",
    pattern: /^@corpsim\/[A-Za-z0-9_-]+\/src(\/|$)/
  }
];

function listTrackedSourceFiles() {
  const output = execFileSync("git", ["ls-files"], {
    encoding: "utf8"
  });

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((filePath) => ALLOWED_EXTENSIONS.has(extname(filePath)))
    .filter((filePath) => !filePath.includes("node_modules/"))
    .filter((filePath) => !filePath.includes(".next/"));
}

function findViolationsInFile(filePath) {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const violations = [];
  const importRegex = /(?:from\s+|import\s+)(?:type\s+)?["']([^"']+)["']/g;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    let match = importRegex.exec(line);

    while (match) {
      const source = match[1] ?? "";

      for (const rule of FORBIDDEN_IMPORT_RULES) {
        if (rule.pattern.test(source)) {
          violations.push({
            filePath,
            line: index + 1,
            source,
            rule: rule.name
          });
          break;
        }
      }

      match = importRegex.exec(line);
    }

    importRegex.lastIndex = 0;
  }

  return violations;
}

function run() {
  const files = listTrackedSourceFiles();
  const violations = files.flatMap((filePath) => findViolationsInFile(filePath));

  if (violations.length === 0) {
    console.log("Import boundary check passed.");
    return;
  }

  console.error("Import boundary check failed.");
  console.error("Use package entry points instead of deep imports into packages/*/src.");

  for (const violation of violations) {
    console.error(
      `- ${violation.filePath}:${violation.line} (${violation.rule}) -> ${violation.source}`
    );
  }

  process.exitCode = 1;
}

run();
