import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { NextResponse } from "next/server";
import { getDiscordServerUrl } from "@/lib/public-links";

let loadedEnv = false;

function ensureEnvironmentLoaded(): void {
  if (loadedEnv) {
    return;
  }

  if (process.env.NEXT_PUBLIC_DISCORD_SERVER_URL) {
    loadedEnv = true;
    return;
  }

  const candidates = [
    process.env.DOTENV_PATH,
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../.env"),
    resolve(process.cwd(), "../../.env")
  ].filter((entry): entry is string => Boolean(entry));

  for (const path of candidates) {
    if (!existsSync(path)) {
      continue;
    }
    config({ path, override: false });
    break;
  }

  loadedEnv = true;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  ensureEnvironmentLoaded();

  return NextResponse.json(
    {
      discordServerUrl: getDiscordServerUrl()
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
