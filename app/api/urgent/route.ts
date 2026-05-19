import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

export type UrgencyResult = {
  email_id: string
  is_read: boolean
  urgent: boolean
  sender_tier: "Personal" | "Professional" | "Institutional" | "Commercial"
  signal_1_time: boolean
  signal_2_consequence: boolean
  signal_3_tier: "Personal" | "Professional" | "Institutional" | "Commercial"
  unclear_ask: boolean
  implied_ask: string | null
}

const SYSTEM_PROMPT = `You are an email urgency classifier. Given a batch of emails, return a JSON array — one object per email — with no markdown, no explanation, just the raw JSON array.

For each email, evaluate three signals:

Signal 1 — Time (signal_1_time): true if ANY of these are detected:
- Explicit deadline ("by Friday", "due March 5")
- Relative time reference ("by tomorrow", "within 48 hours", "before the weekend")
- Implicit calendar anchor ("before the meeting", "ahead of the launch", "before we go live")
- Soft pressure ("whenever you get a chance today", "hoping to hear back soon")
- Numbered time window ("in the next 3 days", "within the hour")
- Institutional or Personal sender where context implies a deadline even if unstated

Signal 2 — Consequence (signal_2_consequence): true if ANY of these are detected:
- Direct question addressed to the user ("Can you…?", "What do you think…?")
- User is mentioned or named as the intended responder
- Waiting or holding language ("we're holding off until we hear from you")
- Approval or sign-off language ("needs your green light", "please sign off")
- Implicit ask buried in the body — surface it in implied_ask
- If no ask is detectable but user is clearly the intended recipient → unclear_ask: true

Signal 3 — Sender tier (signal_3_tier):
- Personal: family, close contacts, personal email addresses (gmail/icloud/hotmail with a person's name)
- Professional: manager, client, colleague, company domain
- Institutional: government (USCIS, IRS), hospitals, courts, banks, insurance, legal
- Commercial: retail, subscriptions, services, marketing (e.g. walmart.com, newsletter@...)

Urgency rules (urgent = true if ANY apply):
- sender_tier == "Institutional" → urgent = true
- sender_tier == "Personal" AND (signal_1 OR signal_2) → urgent = true
- sender_tier == "Professional" AND (signal_1 OR signal_2) → urgent = true
- sender_tier == "Commercial" AND (signal_1 AND signal_2) → urgent = true
- signal_1 AND signal_2 → urgent = true (regardless of tier)

Edge cases:
- Thread with multiple emails: evaluate only the most recent unread email
- Forwarded emails: sender_tier based on original sender, not forwarder
- Auto-generated emails with a person's name: check actual domain to determine tier
- Emails with no body: classify by subject + sender tier only, set unclear_ask: true

Output schema per email:
{
  "email_id": string,
  "is_read": false,
  "urgent": boolean,
  "sender_tier": "Personal" | "Professional" | "Institutional" | "Commercial",
  "signal_1_time": boolean,
  "signal_2_consequence": boolean,
  "signal_3_tier": "Personal" | "Professional" | "Institutional" | "Commercial",
  "unclear_ask": boolean,
  "implied_ask": string | null
}

Return ONLY the JSON array. No markdown fences, no explanation.`

export async function POST(req: NextRequest) {
  const { emails } = await req.json()

  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ results: [] })
  }

  const anthropicKey = (process as typeof process & { env?: { ANTHROPIC_API_KEY?: string } }).env
    ?.ANTHROPIC_API_KEY

  if (!anthropicKey) {
    return NextResponse.json({ results: [] })
  }

  // Use short index keys to avoid bloating LLM output with long base64 IDs
  const safeEmails = emails as Array<Record<string, unknown>>
  const indexToId = new Map<string, string>()
  const emailList = safeEmails.map((email, i) => {
    const key = `e${i}`
    indexToId.set(key, String(email.id ?? ""))
    return {
      id: key,
      from: String(email.from ?? ""),
      fromAddress: String(email.fromAddress ?? ""),
      subject: String(email.subject ?? ""),
      body: String(email.body ?? email.preview ?? "").slice(0, 400),
      receivedAt: String(email.receivedAt ?? ""),
    }
  })

  try {
    const client = new Anthropic({ apiKey: anthropicKey })
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Classify these emails:\n${JSON.stringify(emailList, null, 2)}`,
        },
      ],
    })

    const raw = response.content.map((b) => ("text" in b ? b.text : "")).join("").trim()

    // Extract JSON array robustly — find first [ to last ]
    const start = raw.indexOf("[")
    const end = raw.lastIndexOf("]")
    if (start === -1 || end === -1) throw new Error(`No JSON array found in response: ${raw.slice(0, 200)}`)
    const parsed: UrgencyResult[] = JSON.parse(raw.slice(start, end + 1))

    // Remap short index keys back to real email IDs
    const results = parsed.map((r) => ({
      ...r,
      email_id: indexToId.get(r.email_id) ?? r.email_id,
    }))

    return NextResponse.json({ results })
  } catch (error) {
    console.error("Urgency classification failed:", (error as Error).message)
    return NextResponse.json({ results: [], error: (error as Error).message })
  }
}
