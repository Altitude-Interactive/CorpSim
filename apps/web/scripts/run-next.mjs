import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { config as loadDotenv } from "dotenv";

function loadEnvironment() {
  const dotenvPath = process.env.DOTENV_PATH;
  if (dotenvPath && existsSync(dotenvPath)) {
    loadDotenv({ path: dotenvPath });
    return;
  }

  const candidates = [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env.local"),
    resolve(process.cwd(), "../../.env")
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      loadDotenv({ path: candidate });
      return;
    }
  }
}

function readPort(): string {
  const raw = process.env.WEB_PORT ?? process.env.PORT;
  if (!raw) {
    throw new Error("WEB_PORT or PORT environment variable is required");
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid WEB_PORT/PORT value: ${raw}`);
  }

  return String(parsed);
}

function run() {
  const mode = process.argv[2];
  if (mode !== "dev" && mode !== "start") {
    throw new Error("Usage: node scripts/run-next.mjs <dev|start>");
  }

  loadEnvironment();
  const port = readPort();

  const executable = process.platform === "win32" ? "next.cmd" : "next";
  const child = spawn(executable, [mode, "-p", port], {
    stdio: "inherit",
    env: process.env
  });

  child.on("error", (error) => {
    console.error(`[web:${mode}] failed to start`, error);
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

run();
