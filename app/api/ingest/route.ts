import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { blocklist, voicemails } from "@/lib/db/schema";
import { requireApiKey } from "@/lib/auth";
import { classifyTranscript, deriveLabel } from "@/lib/keywords";
import { normalizeE164 } from "@/lib/phone";

export const runtime = "nodejs";

const bodySchema = z.object({
  from: z.string().min(1),
  transcript: z.string().min(1),
  source: z.string().default("manual"),
});

export async function POST(req: Request) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "invalid body", detail: String(err) },
      { status: 400 },
    );
  }

  const e164 = normalizeE164(body.from);
  if (!e164) {
    return NextResponse.json(
      { error: "couldn't parse phone number", from: body.from },
      { status: 400 },
    );
  }

  const classification = classifyTranscript(body.transcript);

  const [voicemail] = await db
    .insert(voicemails)
    .values({
      fromNumber: e164,
      transcript: body.transcript,
      source: body.source,
      matchedKeywords: classification.matched,
      blocked: classification.isSpam,
    })
    .returning();

  let blocklisted = false;
  if (classification.isSpam) {
    const label = deriveLabel(classification.matched);
    await db
      .insert(blocklist)
      .values({
        number: e164,
        label,
        source: "voicemail",
        sourceVoicemailId: voicemail.id,
      })
      .onConflictDoNothing({ target: blocklist.number });
    blocklisted = true;
  }

  return NextResponse.json({
    voicemailId: voicemail.id,
    matched: classification.matched,
    blocked: blocklisted,
  });
}
