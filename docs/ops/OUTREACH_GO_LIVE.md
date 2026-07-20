# Outreach go-live checklist (Instantly email + Twilio SMS)

Cold email runs through **Instantly**. Cold SMS runs through **Twilio** via `/api/sms-outreach`.  
Widget lead alerts (Resend/Twilio to contractors) are separate and already live.

Keep these defaults until a pilot is clean:

| Env | Value |
|-----|--------|
| `INSTANTLY_WARMUP_MODE` | `true` |
| `INSTANTLY_AUTO_START` | `false` |

---

## 0. Prerequisites

- [ ] Instantly: sending domains + SPF/DKIM/DMARC
- [ ] Instantly: mailbox warmup in progress
- [ ] Instantly API key on dashboard Vercel (`INSTANTLY_API_KEY` + path envs)
- [ ] Twilio number + Messaging webhook → `https://<dashboard>/api/webhooks/twilio`
- [ ] Set `TWILIO_WEBHOOK_URL` to that exact public URL (signature validation)
- [ ] Set `OUTREACH_LOOM_URL` and `OUTREACH_LANDING_URL` (scraper + dashboard)
- [ ] Set `INSTANTLY_WEBHOOK_SECRET` (or reuse `INSTANTLY_RECEIVER_AUTH_TOKEN`) for Instantly Unsubscribed webhook
- [ ] Scraper: `WEBHOOK_AUTH_TOKEN` matches `INSTANTLY_RECEIVER_AUTH_TOKEN`
- [ ] Scraper Instantly URLs → `/api/instantly/scraper-webhook`
- [ ] Scraper `SMS_OUTREACH_WEBHOOK_URL` → `/api/sms-outreach`

---

## 1. Dry-run scrape (no sends)

1. Set scraper `DISABLE_WEBHOOKS=true`
2. Run a one-city scrape
3. Review CSVs + `instantly_campaign_playbook.md`
4. Confirm no `[INSERT_LOOM_LINK]` / `[INSERT_LANDING_PAGE_LINK]` leftovers (set outreach URL envs)

---

## 2. Manual Instantly pilot

1. Upload a tiny CSV into Instantly (5–20 leads)
2. Confirm sequence + schedule (Mon–Fri 9–17 America/Chicago, ~20/day)
3. Activate at low volume; watch bounces/replies

---

## 3. Enable Instantly import webhooks (still no auto-start)

1. Set `DISABLE_WEBHOOKS=false`
2. Keep `INSTANTLY_AUTO_START=false` and `INSTANTLY_WARMUP_MODE=true`
3. Run a scrape; confirm `instantly_sync_events` rows and leads imported
4. Campaign must **not** auto-activate

---

## 4. Instantly Unsubscribed webhook

1. Instantly → Settings → Webhooks → **Unsubscribed**
2. URL: `https://<dashboard>/api/webhooks/instantly`
3. Auth header: `Authorization: Bearer <INSTANTLY_WEBHOOK_SECRET>`
4. Test unsubscribe → row in `global_suppressions` (type=email)

---

## 5. Twilio STOP + Instantly blocklist

1. Text STOP to the Twilio number
2. Confirm phone (+ related emails) in `global_suppressions`
3. Confirm Instantly block-list entry created for related emails

---

## 6. Small SMS pilot

1. Set `SMS_MAX_DAILY` low (e.g. `10`)
2. Ensure phone-only Pipeline B leads hit `/api/sms-outreach`
3. Confirm step-1 sends during Mon–Fri 9–17 CT
4. Wait for `/api/cron/sms-followups` (weekdays 16:00 UTC ≈ 11:00 America/Chicago) for step-2 after `SMS_STEP2_DELAY_DAYS` (default 2)

---

## 7. Later (only after confidence)

1. `INSTANTLY_AUTO_START=true`
2. `INSTANTLY_WARMUP_MODE=false`
3. Raise Instantly daily volume gradually
4. Raise `SMS_MAX_DAILY` gradually

---

## Safety summary

| Control | Behavior |
|---------|----------|
| Email suppressions | Filtered before Instantly import |
| Instantly unsub | Auth required; writes `global_suppressions` |
| SMS STOP | Signature-validated; suppressions + Instantly blocklist |
| SMS caps | `SMS_MAX_DAILY` (default 50) + weekday send window |
| Auto-start | Blocked while warmup mode on |

## Key routes

- `POST /api/instantly/scraper-webhook` — Instantly import
- `POST /api/sms-outreach` — SMS step 1
- `GET /api/cron/sms-followups` — SMS step 2
- `POST /api/webhooks/instantly` — Instantly Unsubscribed
- `POST /api/webhooks/twilio` — inbound SMS / STOP
