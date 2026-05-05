# Deploy checklist

Run these once. Order matters. Estimated total time: ~20 min.

## 1. Provision Neon database

1. Go to https://console.neon.tech and pick the project you want to host this in (or create one).
2. Create a new database called `spam_shield` (or reuse an existing one — just give the tables their own naming).
3. Copy the **pooled connection string** from the dashboard. It looks like
   `postgres://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/spam_shield?sslmode=require`.

## 2. Generate API key

```sh
openssl rand -hex 32
```

Save it somewhere — you'll paste it into Vercel env vars AND into the iOS app once.

## 3. Deploy to Vercel

```sh
cd /root/projects/spam-shield-server
npm i -g vercel        # if not installed
vercel login
vercel link            # accept defaults; project name "spam-shield-server" is fine
vercel env add DATABASE_URL production
# paste the Neon URL when prompted
vercel env add API_KEY production
# paste the openssl-generated key
vercel --prod
```

You'll get a URL like `https://spam-shield-server-xxx.vercel.app`. Hit it — should return the admin UI shell.

Optional: alias to a custom domain (e.g. `spam-shield.thomas-hart.com`) via `vercel domains add` + a CNAME in GoDaddy.

## 4. Push schema to Neon

After the deploy, run once locally:
```sh
DATABASE_URL='<paste pooled URL>' pnpm db:push
```

This creates the `voicemails` and `blocklist` tables. Subsequent schema changes also use `pnpm db:push`.

## 5. Smoke-test from your laptop

```sh
URL=https://your-vercel-url.vercel.app
KEY=<your api key>

curl -s "$URL/api/blocklist" -H "authorization: Bearer $KEY"
# -> {"version":"...","count":0,"numbers":[]}

curl -s -X POST "$URL/api/ingest" \
  -H "authorization: Bearer $KEY" \
  -H "content-type: application/json" \
  -d '{"from":"+18015551234","transcript":"Hi this is John from the IRS tax relief department"}'
# -> {"voicemailId":1,"matched":["tax relief","irs"],"blocked":true}

curl -s "$URL/api/blocklist" -H "authorization: Bearer $KEY"
# -> {"count":1,"numbers":[{"number":"18015551234","label":"Tax Relief Spam"}]}
```

Open the URL in a browser, paste the API key, you should see the blocklist + voicemails populated.

## 6. Wire up voicemail ingestion (pick one)

### Option A — Carrier voicemail-to-email (free, ~30 min setup)

Most US carriers email you a transcript when you get a voicemail. We'll funnel those emails through Resend Inbound (since you already use Resend).

1. **Verify carrier is set up.** AT&T Visual Voicemail, Verizon Visual Voicemail Plus, T-Mobile Voicemail to Text — should email you transcripts to your Gmail.
2. **Add a subdomain** (e.g. `vm.thomas-hart.com`) in GoDaddy or wherever you manage DNS.
3. **Set up Resend Inbound** at https://resend.com/inbound → add the subdomain, copy the MX records, paste them into your DNS provider. Wait ~5 min for propagation.
4. **Configure inbound parsing** in Resend to forward parsed emails as a webhook to:
   ```
   https://your-vercel-url.vercel.app/api/voicemail-email
   ```
   (We'll need to add this endpoint — it'll convert the email payload into the `/api/ingest` format. ~20 lines, file me a TODO when you're at this step.)
5. **Gmail filter**: From `→ Forward to → vm@vm.thomas-hart.com`, matching from your carrier's voicemail address.

### Option B — Twilio (≈$1/mo + per-call charges, simpler wiring)

Costs money but the wiring is one webhook. If you eventually want richer features (call recording, custom IVR, blocking at the carrier layer) Twilio is the right place anyway.

1. Buy a Twilio number (~$1.15/mo) at https://console.twilio.com/.
2. Set up a TwiML voicemail flow that records and transcribes.
3. Point its transcription webhook at `https://your-vercel-url.vercel.app/api/twilio-transcription` (another small adapter we'd add).
4. Forward your real number to the Twilio number when you don't answer (handled in your carrier's settings).

### Option C — Manual paste (zero infra, 10 sec per voicemail)

Open the admin UI, paste the transcript and number into the manual-add form. Useful while you're still tuning the keyword list.

## 7. Configure the iOS app

After Apple enrollment lands and the iOS app is on your phone via TestFlight:

1. Open SpamShield on the iPhone.
2. Server sync section → paste the Vercel URL (no trailing slash) and the API key.
3. Tap **Save & sync now**.
4. The app pulls the current blocklist, merges it locally, and reloads the extension.

From then on, every voicemail that hits the server gets classified, and the next time the app opens (or you tap Sync), the new numbers land on the phone.

## Files you'll edit when extending

- `lib/keywords.ts` — add/remove keyword patterns. Substring list for multi-word phrases, word-boundary list for short words like "loan" so it doesn't false-positive on "alone".
- `lib/db/schema.ts` — schema changes; run `pnpm db:generate` then `pnpm db:push`.
- `app/api/ingest/route.ts` — change the ingest contract (e.g. accept audio URL, extra metadata).
- `app/page.tsx` — admin UI tweaks.
