# Mailflow

A local-first Outlook inbox assistant that reads, digests, and replies — all within one flow.

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Claude](https://img.shields.io/badge/Powered%20by-Claude%20AI-orange)

---

## What it does

**Glimpse** — Unified inbox view. Every unread email as a card with sender, subject, relative timestamp, and preview. Scrollable, with a live urgent count driven by LLM classification.

**Daily Bite** — One-click structured 5-minute digest, streamed in real time. Triages your inbox into: Time-sensitive, Action Required, FYI, and Noise. Powered by Claude Haiku with prompt caching.

**Reply** — Select any email, get an AI-generated context-aware draft, edit it, and send — all in one place. Sent emails are automatically marked as read in Outlook.

**Urgent classification** — Each email is scored across three signals (time sensitivity, consequence, sender tier) by Claude. Results persist across sessions and update every 5 minutes in the background.

---

## Tech stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **AI**: Anthropic Claude (Haiku for digest, Sonnet for drafts and urgency classification)
- **Email**: Microsoft Graph API (Outlook / Microsoft 365)
- **Auth**: OAuth 2.0 via Microsoft identity platform
- **Storage**: Encrypted local JSON (AES via crypto-js)
- **Font**: DM Sans (400, 500)
- **Styling**: Tailwind CSS

---

## Getting started

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)
- A Microsoft Azure app registration with `Mail.ReadWrite`, `Mail.Send`, and `offline_access` scopes

### 1. Clone and install

```bash
git clone https://github.com/your-username/mailflow.git
cd mailflow
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `STORAGE_KEY` | Random base64 string for local encryption (`openssl rand -base64 32`) |
| `OUTLOOK_CLIENT_ID` | Azure app registration client ID |
| `OUTLOOK_CLIENT_SECRET` | Azure app registration client secret |
| `OUTLOOK_REDIRECT_URI` | OAuth redirect URI (default: `http://localhost:3000/api/auth/callback`) |

### 3. Set up Azure app registration

1. Go to [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps)
2. Create a new registration
3. Add a redirect URI: `http://localhost:3000/api/auth/callback`
4. Under **API permissions**, add:
   - `Microsoft Graph → Mail.ReadWrite`
   - `Microsoft Graph → Mail.Send`
   - `offline_access`
5. Create a client secret and copy the value

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click the connection icon, and sign in with Outlook.

---

## Project structure

```
app/
  api/
    auth/          # OAuth login, callback, logout
    draft/         # AI reply draft generation
    drafts/        # Save draft locally
    emails/        # Fetch unread inbox + token refresh
    mark-read/     # Mark email as read via Graph API
    send/          # Send reply + mark as read
    summary/       # Streaming AI digest (Daily Bite)
    urgent/        # LLM urgency classification
  original/[id]/   # Full email view
  page.tsx         # Main UI
  layout.tsx       # Root layout (DM Sans font)

lib/
  data.ts          # Email type + sample data
  local-store.ts   # Encrypted local storage
  outlook-oauth.ts # Microsoft Graph API client
  secure-storage.ts # AES encryption/decryption

data/              # Local runtime storage (gitignored)
```

---

## Security

- `.env.local` is gitignored — never committed
- `data/` is gitignored — contains encrypted session tokens
- Local drafts are AES-encrypted at rest using your `STORAGE_KEY`
- No email content is stored permanently — only reply drafts you explicitly save

---

## License

MIT
