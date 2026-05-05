CREATE TABLE "blocklist" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"label" text DEFAULT 'Spam' NOT NULL,
	"source" text NOT NULL,
	"source_voicemail_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voicemails" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_number" text NOT NULL,
	"transcript" text NOT NULL,
	"source" text NOT NULL,
	"matched_keywords" text[] DEFAULT '{}' NOT NULL,
	"blocked" boolean DEFAULT false NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blocklist" ADD CONSTRAINT "blocklist_source_voicemail_id_voicemails_id_fk" FOREIGN KEY ("source_voicemail_id") REFERENCES "public"."voicemails"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "blocklist_number_unique" ON "blocklist" USING btree ("number");--> statement-breakpoint
CREATE INDEX "voicemails_from_idx" ON "voicemails" USING btree ("from_number");--> statement-breakpoint
CREATE INDEX "voicemails_ingested_idx" ON "voicemails" USING btree ("ingested_at");