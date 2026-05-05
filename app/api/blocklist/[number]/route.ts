import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { blocklist } from "@/lib/db/schema";
import { requireApiKey } from "@/lib/auth";
import { normalizeE164 } from "@/lib/phone";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  const { number } = await params;
  const e164 = normalizeE164(number);
  if (!e164) {
    return NextResponse.json(
      { error: "couldn't parse phone number" },
      { status: 400 },
    );
  }

  const removed = await db
    .delete(blocklist)
    .where(eq(blocklist.number, e164))
    .returning();

  return NextResponse.json({ removed: removed.length });
}
