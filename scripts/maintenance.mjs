#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

const DEFAULT_MAINTENANCE_REASON = "Systems are currently being updated.";
const DEFAULT_SCOPE = "all";
const NO_DEV_ENVIRONMENT_MESSAGE =
  "No dev environment detected. Nothing to toggle; you're free to code.";
const SERVICE_PROBE_TIMEOUT_MS = 900;

class HttpRequestError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "HttpRequestError";
    this.status = status;
  }
}

function loadEnvironment() {
  const explicitPath = process.env.DOTENV_PATH;
  if (explicitPath && existsSync(explicitPath)) {
    loadDotenv({ path: explicitPath });
    return;
  }

  const candidates = [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../.env.local"),
    resolve(process.cwd(), "../.env"),
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

function normalizeBaseUrl(value) {
  if (!value || typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function parsePort(value) {
  if (!value || typeof value !== "string") {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function findRepoRoot(startDir) {
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

function buildDefaultState() {
  return {
    enabled: false,
    updatedAt: new Date().toISOString(),
    reason: DEFAULT_MAINTENANCE_REASON,
    scope: DEFAULT_SCOPE
  };
}

function sanitizeScope(value, fallback = DEFAULT_SCOPE) {
  if (value === "all" || value === "web-only") {
    return value;
  }

  return fallback;
}

function sanitizeReason(value, fallback = DEFAULT_MAINTENANCE_REASON) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function sanitizeEnabledBy(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeEta(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return new Date(parsed).toISOString();
}

function sanitizeUpdatedAt(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return new Date(parsed).toISOString();
}

function sanitizeState(raw, fallback = buildDefaultState()) {
  return {
    enabled: raw?.enabled === true,
    updatedAt: sanitizeUpdatedAt(raw?.updatedAt, fallback.updatedAt),
    reason: sanitizeReason(raw?.reason, fallback.reason),
    enabledBy: sanitizeEnabledBy(raw?.enabledBy),
    scope: sanitizeScope(raw?.scope, fallback.scope),
    eta: sanitizeEta(raw?.eta)
  };
}

function uniqueValues(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null))];
}

async function probeUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, SERVICE_PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal
    });
    return response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function findReachableWebUrl() {
  const configuredAppUrl = normalizeBaseUrl(process.env.APP_URL);
  const webPorts = uniqueValues([
    parsePort(process.env.WEB_PORT),
    parsePort(process.env.PORT),
    4311,
    3000
  ]);

  const candidates = [
    configuredAppUrl,
    ...webPorts.map((port) => `http://localhost:${port}`),
    ...webPorts.map((port) => `http://127.0.0.1:${port}`)
  ].filter(Boolean);

  for (const baseUrl of candidates) {
    if (await probeUrl(`${baseUrl}/`)) {
      return baseUrl;
    }
  }

  return undefined;
}

function resolveApiBaseCandidates() {
  const configuredBaseUrls = uniqueValues([
    normalizeBaseUrl(process.env.API_URL),
    normalizeBaseUrl(process.env.API_INTERNAL_URL),
    normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL)
  ]);

  const apiPorts = uniqueValues([parsePort(process.env.API_PORT), 4310]);
  const localhostBases = apiPorts.flatMap((port) => [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`
  ]);

  return uniqueValues([...configuredBaseUrls, ...localhostBases]);
}

async function findReachableApiBaseUrl() {
  for (const baseUrl of resolveApiBaseCandidates()) {
    if (await probeUrl(`${baseUrl}/health/maintenance`)) {
      return baseUrl;
    }

    if (await probeUrl(`${baseUrl}/health`)) {
      return baseUrl;
    }
  }

  return undefined;
}

function parseJsonOrThrow(text, url) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response from ${url}`);
  }
}

async function fetchMaintenanceFromApi(apiBaseUrl) {
  const url = `${apiBaseUrl}/health/maintenance`;
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store"
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new HttpRequestError(
      `Failed to read maintenance status from API (${response.status})`,
      response.status
    );
  }

  const payload = parseJsonOrThrow(bodyText, url);
  return sanitizeState(payload);
}

async function postMaintenanceToApi(apiBaseUrl, payload, token) {
  const headers = {
    "Content-Type": "application/json"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${apiBaseUrl}/ops/maintenance`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  const bodyText = await response.text();
  if (!response.ok) {
    let message = `API rejected maintenance toggle (${response.status})`;

    try {
      const parsed = JSON.parse(bodyText);
      if (parsed && typeof parsed === "object" && typeof parsed.message === "string") {
        message = parsed.message;
      }
    } catch {
      // Keep default message if body is not JSON.
    }

    throw new HttpRequestError(message, response.status);
  }

  const parsed = parseJsonOrThrow(bodyText, `${apiBaseUrl}/ops/maintenance`);
  return sanitizeState(parsed);
}

async function readStateFromFile(filePath) {
  const fallback = buildDefaultState();

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return sanitizeState(parsed, fallback);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return fallback;
    }
    return fallback;
  }
}

async function writeStateToFile(filePath, state) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function parseOptions(args) {
  const options = {
    reason: undefined,
    scope: undefined,
    force: false,
    eta: undefined
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg.startsWith("--reason=")) {
      options.reason = arg.slice("--reason=".length);
      continue;
    }

    if (arg === "--reason") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Missing value for --reason");
      }
      options.reason = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--scope=")) {
      options.scope = arg.slice("--scope=".length);
      continue;
    }

    if (arg === "--scope") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Missing value for --scope");
      }
      options.scope = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--eta=")) {
      options.eta = arg.slice("--eta=".length);
      continue;
    }

    if (arg === "--eta") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Missing value for --eta");
      }
      options.eta = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (options.scope && options.scope !== "all" && options.scope !== "web-only") {
    throw new Error(`Invalid --scope value: ${options.scope}. Use "all" or "web-only".`);
  }

  return options;
}

function resolveActor() {
  const explicit = process.env.CORPSIM_OPS_ACTOR?.trim();
  if (explicit) {
    return explicit;
  }

  const username = process.env.USERNAME?.trim() || process.env.USER?.trim();
  return username || "agent";
}

function printState(state, source) {
  const mode = state.enabled ? "ENABLED" : "DISABLED";
  console.log(`Maintenance mode: ${mode}`);
  console.log(`Scope: ${state.scope}`);
  console.log(`Reason: ${state.reason}`);
  console.log(`Updated at: ${state.updatedAt}`);
  if (state.enabledBy) {
    console.log("Enabled by: [redacted]");
  }
  if (state.eta) {
    console.log(`ETA: ${state.eta}`);
  }
  console.log(`Source: ${source}`);
}

async function resolveStateForStatus(apiBaseUrl, maintenanceFilePath) {
  if (apiBaseUrl) {
    return {
      source: "api",
      state: await fetchMaintenanceFromApi(apiBaseUrl)
    };
  }

  return {
    source: "file",
    state: await readStateFromFile(maintenanceFilePath)
  };
}

function buildPayload(command, options, currentState) {
  const actor = resolveActor();
  const enabling = command === "on";

  if (enabling) {
    return {
      enabled: true,
      reason: sanitizeReason(options.reason, DEFAULT_MAINTENANCE_REASON),
      scope: sanitizeScope(options.scope, DEFAULT_SCOPE),
      enabledBy: actor,
      eta: sanitizeEta(options.eta)
    };
  }

  return {
    enabled: false,
    reason: options.reason ? sanitizeReason(options.reason, currentState.reason) : undefined,
    scope: options.scope ? sanitizeScope(options.scope, currentState.scope) : undefined,
    enabledBy: actor,
    eta: options.eta ? sanitizeEta(options.eta) : undefined
  };
}

function usage() {
  console.log("Usage:");
  console.log(
    "  pnpm maintenance:on [--reason \"...\"] [--scope all|web-only] [--eta \"ISO8601-timestamp\"] [--force]"
  );
  console.log("  pnpm maintenance:off [--force]");
  console.log("  pnpm maintenance:status");
}

async function run() {
  loadEnvironment();

  const [command, ...restArgs] = process.argv.slice(2);
  if (!command || !["on", "off", "status"].includes(command)) {
    usage();
    process.exitCode = 1;
    return;
  }

  const options = parseOptions(restArgs);
  const maintenanceFilePath = resolve(findRepoRoot(process.cwd()), ".corpsim", "maintenance.json");
  const [webUrl, apiBaseUrl] = await Promise.all([findReachableWebUrl(), findReachableApiBaseUrl()]);

  if (command === "status") {
    const { source, state } = await resolveStateForStatus(apiBaseUrl, maintenanceFilePath);
    printState(state, source);
    return;
  }

  const hasReachableService = Boolean(webUrl || apiBaseUrl);
  if (!hasReachableService && !options.force) {
    console.log(NO_DEV_ENVIRONMENT_MESSAGE);
    return;
  }

  const currentState = apiBaseUrl
    ? await fetchMaintenanceFromApi(apiBaseUrl).catch(() => readStateFromFile(maintenanceFilePath))
    : await readStateFromFile(maintenanceFilePath);

  const payload = buildPayload(command, options, currentState);
  const token = process.env.CORPSIM_OPS_TOKEN?.trim();

  if (apiBaseUrl) {
    try {
      const state = await postMaintenanceToApi(apiBaseUrl, payload, token);
      const action = command === "on" ? "enabled" : "disabled";
      console.log(`Maintenance mode ${action} via API.`);
      printState(state, "api");
      return;
    } catch (error) {
      if (error instanceof HttpRequestError && (error.status === 401 || error.status === 403)) {
        throw error;
      }
    }
  }

  const nextState = sanitizeState(
    {
      enabled: payload.enabled,
      updatedAt: new Date().toISOString(),
      reason: payload.reason ?? currentState.reason,
      enabledBy: payload.enabledBy,
      scope: payload.scope ?? currentState.scope
    },
    currentState
  );
  await writeStateToFile(maintenanceFilePath, nextState);

  const action = command === "on" ? "enabled" : "disabled";
  console.log(`Maintenance mode ${action} via file fallback.`);
  printState(nextState, "file");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : "Maintenance command failed");
  process.exitCode = 1;
});
