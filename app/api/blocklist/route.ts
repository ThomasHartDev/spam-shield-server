import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { blocklist } from "@/lib/db/schema";
import { requireApiKey } from "@/lib/auth";
import { normalizeE164 } from "@/lib/phone";
import { asc } from "drizzle-orm";

export const runtime = "nodejs";

// iOS Call Directory Extension polls this on launch / extension reload.
// Returns numbers as strings to avoid Int64 precision loss across JSON.
export async function GET(req: Request) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  const rows = await db
    .select({
      number: blocklist.number,
      label: blocklist.label,
    })
    .from(blocklist)
    .orderBy(asc(blocklist.number));

  return NextResponse.json({
    version: new Date().toISOString(),
    count: rows.length,
    numbers: rows,
  });
}

const postSchema = z.object({
  number: z.string().min(1),
  label: z.string().default("Spam"),
});

// Manual add (admin UI uses this).
export async function POST(req: Request) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  let body: z.infer<typeof postSchema>;
  try {
    body = postSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "invalid body", detail: String(err) },
      { status: 400 },
    );
  }

  const e164 = normalizeE164(body.number);
  if (!e164) {
    return NextResponse.json(
      { error: "couldn't parse phone number" },
      { status: 400 },
    );
  }

  const [row] = await db
    .insert(blocklist)
    .values({
      number: e164,
      label: body.label,
      source: "manual",
    })
    .onConflictDoUpdate({
      target: blocklist.number,
      set: { label: body.label },
    })
    .returning();

  return NextResponse.json({ added: row });
}
