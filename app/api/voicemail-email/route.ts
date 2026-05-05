import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { blocklist, voicemails } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { classifyTranscript, deriveLabel } from "@/lib/keywords";
import { extractPhoneNumber, normalizeE164 } from "@/lib/phone";

export const runtime = "nodejs";

// Postmark Inbound webhook adapter. Postmark POSTs a JSON payload here when
// a voicemail-transcript email lands in your Postmark inbound stream
// (typically forwarded from Gmail by a filter). We pull the caller's number
// out of the Subject / TextBody, run the existing classifier, and insert into
// the same voicemails + blocklist tables that /api/ingest writes to.
//
// Auth: ?key=API_KEY query param. Postmark's webhook UI lets you bake any
// query string into the URL but won't reliably set custom headers on every
// stream type, so query param is the most portable.
//
// Postmark payload shape (relevant fields only):
//   https://postmarkapp.com/developer/webhooks/inbound-webhook

const payloadSchema = z.object({
  From: z.string().optional(),
  FromName: z.string().optional(),
  Subject: z.string().optional(),
  TextBody: z.string().optional(),
  HtmlBody: z.string().optional(),
  StrippedTextReply: z.string().optional(),
  MessageID: z.string().optional(),
});

export async function POST(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key || key !== env.API_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof payloadSchema>;
  try {
    body = payloadSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "invalid payload", detail: String(err) },
      { status: 400 },
    );
  }

  const subject = body.Subject ?? "";
  const text = body.TextBody ?? body.StrippedTextReply ?? "";

  // Caller number tends to be in the Subject ("Voicemail from (801) 555-0123")
  // or the first line of the body ("Caller: ..."). Try Subject first, fall
  // back to body.
  const rawNumber = extractPhoneNumber(subject) ?? extractPhoneNumber(text);
  const e164 = rawNumber ? normalizeE164(rawNumber) : null;

  // Even if we can't pull a phone number, log the voicemail so we can debug
  // carrier-specific email formats later. fromNumber stays "unknown" in that case.
  const fromNumber = e164 ?? "unknown";
  const transcript = text || subject || "(no transcript in email)";

  const classification = classifyTranscript(transcript);
  const willBlock = classification.isSpam && e164 !== null;

  const [vm] = await db
    .insert(voicemails)
    .values({
      fromNumber,
      transcript,
      source: "postmark",
      matchedKeywords: classification.matched,
      blocked: willBlock,
    })
    .returning();

  if (willBlock && e164) {
    await db
      .insert(blocklist)
      .values({
        number: e164,
        label: deriveLabel(classification.matched),
        source: "voicemail",
        sourceVoicemailId: vm.id,
      })
      .onConflictDoNothing({ target: blocklist.number });
  }

  return NextResponse.json({
    voicemailId: vm.id,
    extractedNumber: e164,
    matched: classification.matched,
    blocked: willBlock,
  });
}
