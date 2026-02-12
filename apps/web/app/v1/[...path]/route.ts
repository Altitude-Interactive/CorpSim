import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: {
    path: string[];
  };
};

const REQUEST_BLOCKED_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

const RESPONSE_BLOCKED_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

function sanitizeHeaders(source: Headers, blocked: Set<string>): Headers {
  const target = new Headers();
  source.forEach((value, key) => {
    if (!blocked.has(key.toLowerCase())) {
      target.set(key, value);
    }
  });
  return target;
}

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

async function proxyToApi(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const upstreamUrl = new URL(
    `${resolveApiUpstreamBaseUrl()}/v1/${context.params.path.join("/")}`
  );
  upstreamUrl.search = request.nextUrl.search;

  const headers = sanitizeHeaders(request.headers, REQUEST_BLOCKED_HEADERS);
  const method = request.method.toUpperCase();

  let body: ArrayBuffer | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const buffer = await request.arrayBuffer();
    body = buffer.byteLength > 0 ? buffer : undefined;
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual"
    });

    const responseHeaders = sanitizeHeaders(upstreamResponse.headers, RESPONSE_BLOCKED_HEADERS);
    return new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders
    });
  } catch {
    return NextResponse.json({ message: "API upstream is unreachable." }, { status: 502 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyToApi(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyToApi(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyToApi(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyToApi(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyToApi(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  return proxyToApi(request, context);
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return proxyToApi(request, context);
}
