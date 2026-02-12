import { NextResponse } from "next/server";

function resolveApiUpstreamBaseUrl(): string {
  const explicit =
    process.env.API_URL?.trim() ||
    process.env.API_INTERNAL_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim();

  if (explicit) {
    return explicit.endsWith("/") ? explicit.slice(0, -1) : explicit;
  }

  const port = process.env.API_PORT?.trim() || "4310";
  return `http://127.0.0.1:${port}`;
}

async function proxyMetaVersion(): Promise<NextResponse> {
  try {
    const response = await fetch(`${resolveApiUpstreamBaseUrl()}/meta/version`, {
      cache: "no-store",
      redirect: "manual"
    });

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && "message" in payload
          ? String(payload.message)
          : "Version endpoint unavailable";
      return NextResponse.json({ message }, { status: response.status });
    }

    return NextResponse.json(payload, {
      status: response.status,
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch {
    return NextResponse.json({ message: "API upstream is unreachable." }, { status: 502 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return proxyMetaVersion();
}
