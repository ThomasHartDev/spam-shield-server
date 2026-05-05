# spam-shield-server

The brain behind [spam-shield](https://github.com/ThomasHartDev/spam-shield) (the iOS app). Receives voicemail transcripts, classifies them by keyword (tax relief, loans, IRS, extended warranty, etc.), and pushes the calling number into a blocklist that the iOS Call Directory Extension polls.

## Endpoints

All endpoints require `Authorization: Bearer <API_KEY>`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/ingest` | Voicemail webhook. Body: `{ from, transcript, source }`. Classifies, stores, optionally blocklists. |
| GET | `/api/blocklist` | iOS app polls this. Returns `{ version, count, numbers: [{ number, label }] }`. |
| POST | `/api/blocklist` | Manual add. Body: `{ number, label }`. |
| DELETE | `/api/blocklist/:number` | Manual remove. |
| GET | `/api/voicemails` | Recent ingested voicemails (admin UI). |

The admin UI at `/` lets you paste the API key, add/remove numbers, and inspect what's been ingested.

## Stack

- Next.js 15 App Router on Vercel
- Neon Postgres (`DATABASE_URL`)
- Drizzle ORM
- CSS Modules (no Tailwind)

## Local dev

```sh
pnpm install
cp .env.example .env.local
# fill in DATABASE_URL (Neon dashboard) and API_KEY (`openssl rand -hex 32`)
pnpm db:push      # creates tables in Neon from lib/db/schema.ts
pnpm dev
```

Hit it:
```sh
curl -X POST http://localhost:3000/api/ingest \
  -H "authorization: Bearer $API_KEY" \
  -H "content-type: application/json" \
  -d '{"from":"+1 801 555 0123","transcript":"Hi this is John from the IRS tax relief department"}'
# -> { voicemailId: 1, matched: ["irs","tax relief"], blocked: true }
```

## Voicemail ingest paths

The `/api/ingest` endpoint takes any source — pick whichever wiring is cheapest:

- **Carrier voicemail-to-email** → Gmail filter → forward to a parsing service (Resend Inbound, CloudMailin, SendGrid Inbound Parse) → that service POSTs to `/api/ingest`.
- **Twilio Voice + Recording transcription** → webhook to `/api/ingest`.
- **Apple Shortcut on iPhone** that triggers when a voicemail lands and POSTs the transcript.
- **Manual paste** in the admin UI (TODO).

## Deploy

```sh
vercel link
vercel env add DATABASE_URL
vercel env add API_KEY
vercel --prod
```

Then in Neon: `pnpm db:push` against the production URL once.

## How it talks to iOS

The iOS app's `BlocklistStore` does a periodic GET against `/api/blocklist`, merges the remote numbers into local UserDefaults shared via App Group, and triggers `CXCallDirectoryManager.reloadExtension`. The extension reads the merged list and hands it to iOS. (Wiring on the iOS side is a follow-up commit there.)
