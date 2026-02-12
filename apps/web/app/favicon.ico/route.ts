import { NextRequest, NextResponse } from "next/server";

export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/icon.svg", request.url), 308);
}

export const runtime = "nodejs";
