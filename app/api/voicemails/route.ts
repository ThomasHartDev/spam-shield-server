import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { voicemails } from "@/lib/db/schema";
import { requireApiKey } from "@/lib/auth";
import { desc } from "drizzle-orm";

export const runtime = "nodejs";

// Recent voicemails for the admin UI.
export async function GET(req: Request) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  const rows = await db
    .select()
    .from(voicemails)
    .orderBy(desc(voicemails.ingestedAt))
    .limit(100);

  return NextResponse.json({ voicemails: rows });
}
