import { env } from "@/lib/env";
import { NextResponse } from "next/server";

export function requireApiKey(req: Request): NextResponse | null {
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.API_KEY}`;

  // Constant-time-ish compare. Node's timingSafeEqual would need equal lengths;
  // for a personal endpoint behind HTTPS this is fine.
  if (header.length !== expected.length || header !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
