# PCA Region Name Voting — Setup Guide

## Architecture

```
Google Form
    │  (onFormSubmit trigger)
    ▼
Google Apps Script  ──HTTPS + X-Webhook-Secret──▶  Express Server
                                                         │
                              ┌──────────────────────────┤
                              │                          │
                     Field Validator               Audit Logger
                              │                    (Google Sheet)
                     Membership Adapter
                     ┌────────┴────────┐
                 Sheets Adapter    API Adapter
                 (Google Sheet)   (PCA REST API)
                              │
                     Discord Service ──▶ #voting-channel
                              │         (message + reactions)
                     Vote Tracker
                     (Google Sheet)
                              │
                     Discord Bot ◀──── Reaction events
                     (reaction handler)
                              │
                     Admin Notifier ──▶ #admin-channel / email
```

**Components:**
- `apps-script/Code.gs` — Google Apps Script; fires on form submit, POSTs to server
- `src/handlers/formHandler.ts` — Orchestrates validation → membership check → Discord post
- `src/validators/fieldValidator.ts` — Required fields, email, membership number format
- `src/adapters/` — Pluggable membership validation (Sheets, API, Mock)
- `src/services/discordService.ts` — Discord posting with retry/backoff
- `src/services/voteTracker.ts` — Vote recording, duplicate prevention, close detection
- `src/bot/reactionHandler.ts` — Discord bot reaction listener + voting closer
- `src/services/adminNotifier.ts` — Discord + email admin alerts (PII-free)
- `src/services/auditLogger.ts` — Append-only audit trail (Google Sheet)

---

## 1 — Google Form Setup

1. Create a Google Form with these exact question titles:
   - `First Name`
   - `Last Name`
   - `Email Address`
   - `PCA Membership Number`
   - `Proposed Region Name`
   - `Why this name fits`
2. Mark all fields as **Required**.
3. Open the Form editor → **⋮ → Script editor** to open Apps Script.

---

## 2 — Google Apps Script Setup

1. Paste the contents of `apps-script/Code.gs` into the script editor.
2. **Script Properties** (Project Settings → Script Properties → Add):
   | Key | Value |
   |-----|-------|
   | `WEBHOOK_URL` | `https://your-server.example.com/webhook/form-submission` |
   | `WEBHOOK_SECRET` | Same value as `WEBHOOK_SECRET` in your `.env` |
3. **Add Trigger**: Triggers → `+` → Function: `onFormSubmit` → Event source: **From form** → Event type: **On form submit** → Save.
4. Test manually by running `testWebhook()` from the editor.

---

## 3 — Google Sheets Setup

Create two Google Sheets (or two tabs in one sheet) and share them with your service account (`pca-voting@…iam.gserviceaccount.com` with **Editor** access).

### Members Sheet (`MEMBERS_SHEET_ID`)
Used by the Sheets membership adapter to validate member numbers.

| A: MembershipNumber | B: Status | C: ExpiresDate (optional) |
|---------------------|-----------|--------------------------|
| PCA-12345 | ACTIVE | 2025-12-31 |
| PCA-99999 | EXPIRED | 2023-06-01 |

Status values: `ACTIVE`, `EXPIRED`, `INACTIVE`

### Operational Sheet (`SUBMISSIONS_SHEET_ID`)
The server writes to four tabs automatically. Create them with these header rows:

**Submissions** (restricted access — contains PII):
`SubmissionID | ReceivedAt | FirstName | LastName | Email | MembershipNumber | ProposedName | Status`

**Audit** (internal only):
`SubmissionID | Timestamp | Event | MembershipStatus | DiscordMessageID | Error`

**Votes** (internal):
`MessageID | DiscordUserID | VoteType | RecordedAt | Flags`

**Proposals** (internal):
`SubmissionID | MessageID | ProposedName | PostedAt | VotingClosesAt | Closed`

> **Access control**: Share `SUBMISSIONS_SHEET_ID` with the service account as Editor. Restrict human access to the `Submissions` tab to admins only; it contains PII.

---

## 4 — Discord Bot Setup

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**.
2. **Bot** section → **Add Bot** → copy the **Token** → set `DISCORD_BOT_TOKEN`.
3. Under **Privileged Gateway Intents**, enable:
   - **Server Members Intent**
   - **Message Content Intent**
4. **OAuth2 → URL Generator**:
   - Scopes: `bot`
   - Bot Permissions: `Send Messages`, `Add Reactions`, `Read Message History`, `Manage Messages` (for removing duplicate reactions), `View Channel`
5. Use the generated URL to invite the bot to your server.
6. Right-click your voting channel → **Copy Channel ID** → set `DISCORD_VOTING_CHANNEL_ID`.
7. Do the same for your admin/private channel → `DISCORD_ADMIN_CHANNEL_ID`.
8. Right-click your server → **Copy Server ID** → `DISCORD_GUILD_ID`.
9. Enable **Developer Mode** in Discord (Settings → Advanced) to copy IDs.

---

## 5 — Server Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your actual values

# Build TypeScript
npm run build

# Start server
npm start

# Or run in development (hot reload)
npm run dev
```

**Hosting options:**
- **Railway / Render / Fly.io** — Set environment variables in the dashboard, deploy via `npm start`.
- **Google Cloud Run** — Build with `gcloud builds submit`, set env vars in Cloud Run service.
- **Self-hosted VPS** — Use `pm2 start dist/index.js` behind nginx with TLS.

The server **must be reachable from the internet** so Google Apps Script can POST to it.

---

## 6 — Environment Variables

Copy `.env.example` to `.env` and fill in all values. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `WEBHOOK_SECRET` | Yes | 32+ char random string; shared with Apps Script |
| `DISCORD_BOT_TOKEN` | Yes | From Discord Developer Portal |
| `DISCORD_VOTING_CHANNEL_ID` | Yes | Where proposals are posted |
| `DISCORD_ADMIN_CHANNEL_ID` | Yes | Where admin alerts are sent |
| `MEMBERSHIP_ADAPTER` | Yes | `sheets`, `api`, or `mock` |
| `MEMBERS_SHEET_ID` | If adapter=sheets | Google Sheet with member list |
| `SUBMISSIONS_SHEET_ID` | Recommended | Operational sheet for audit/votes |
| `VOTING_DURATION_DAYS` | Yes | Days before voting auto-closes (default: 7) |

---

## 7 — Swapping the Membership Adapter

The `MembershipAdapter` interface (`src/adapters/membershipAdapter.ts`) requires only one method:

```typescript
interface MembershipAdapter {
  validate(normalizedMembershipNumber: string): Promise<MembershipValidationResult>;
}
```

Where `MembershipValidationResult.status` is one of: `valid | invalid | expired | not_found | error`.

To add a new data source:
1. Create `src/adapters/myNewAdapter.ts` implementing `MembershipAdapter`.
2. Add a case to `src/adapters/adapterFactory.ts`.
3. Set `MEMBERSHIP_ADAPTER=myNew` in `.env`.

---

## 8 — Running Tests

```bash
npm test               # run all tests
npm run test:coverage  # with coverage report
```

Test cases cover:
- Valid member submissions → Discord post + proposal recorded
- Invalid/expired/not_found membership → rejected, admin alerted, not posted
- Membership adapter errors → graceful error path
- Discord rate-limit (429) → retry with backoff
- Duplicate Discord votes → rejected silently, duplicate reaction removed
- Field validation: missing fields, invalid email, oversized text
- Webhook secret mismatch → 401, nothing processed
- Vote totals: correct counting, REMOVED votes excluded

---

## Security Notes

- All credentials live in environment variables / Script Properties — never committed to source.
- The `Submissions` sheet (containing PII) should have access restricted to admins; the service account needs Editor access.
- `WEBHOOK_SECRET` prevents unauthorized parties from injecting fake submissions.
- The Discord voting message never includes the submitter's email or membership number.
- Audit log entries sanitize error messages to remove PII before writing.
- Membership validation responses are not echoed to form submitters; all denied submissions receive a generic `200 OK` (to prevent membership number probing).
