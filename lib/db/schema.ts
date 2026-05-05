import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Every voicemail transcript that gets ingested, regardless of whether it
// matched a spam keyword. Useful for auditing what the classifier did and
// for retraining keywords later.
export const voicemails = pgTable(
  "voicemails",
  {
    id: serial("id").primaryKey(),
    fromNumber: text("from_number").notNull(),
    transcript: text("transcript").notNull(),
    source: text("source").notNull(), // "carrier-email" | "manual" | "twilio" | etc.
    matchedKeywords: text("matched_keywords").array().notNull().default([]),
    blocked: boolean("blocked").notNull().default(false),
    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("voicemails_from_idx").on(t.fromNumber),
    index("voicemails_ingested_idx").on(t.ingestedAt),
  ],
);

// One row per blocked number. The iOS Call Directory Extension fetches this
// list and hands it to iOS. number is stored E.164-without-the-plus as a
// string so we don't lose precision crossing JSON boundaries.
export const blocklist = pgTable(
  "blocklist",
  {
    id: serial("id").primaryKey(),
    number: text("number").notNull(),
    label: text("label").notNull().default("Spam"),
    source: text("source").notNull(), // "voicemail" | "manual"
    sourceVoicemailId: integer("source_voicemail_id").references(
      () => voicemails.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("blocklist_number_unique").on(t.number)],
);

export type Voicemail = typeof voicemails.$inferSelect;
export type Blocklisted = typeof blocklist.$inferSelect;
