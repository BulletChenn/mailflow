import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

function summarizeFallback(emails: Array<Record<string, unknown>>) {
  const emailCount = emails.length
  const newest = emails[0]
  return `Quick 5-minute digest\n\nYou have ${emailCount} unread emails. The most recent is "${newest?.subject}" from ${newest?.from}. Review the ones requesting a reply first, then work through any ongoing threads.`
}

const SYSTEM_PROMPT = `You are an email triage assistant. For each batch of emails, produce a 5-minute briefing structured as follows:

⏱️ Time-sensitive — read first
Before all categories, surface any email where delay has a real cost. This includes hard deadlines, implicit calendar anchors ("before the meeting"), waiting-on-you language, or high-tier senders with no stated deadline but clear stakes. One line each. If nothing qualifies, omit this section entirely.

🔴 Action Required
Emails where the user must reply, decide, confirm, or unblock something. For each:
- Sender name and tier (Personal / Professional / Institutional / Commercial)
- One line: what is being asked, stated plainly
- Deadline or urgency signal if present

An email belongs here if any of the following are true:
- A direct question is addressed to the user
- The user is mentioned or named as the intended responder
- Someone is explicitly or implicitly waiting on the user
- Approval, sign-off, or input language is present
- A decision is buried in the thread — extract it, do not leave it implicit.

📋 FYI / Loop-In
Emails for awareness only. Group by thread or topic where possible. One line per item max.

🗑️ Noise
Do not summarize individual emails. Instead, group them by type and provide a one-line count per group. Close with a single sentence observation if a pattern is worth flagging.
Example:
• 10 marketing/promotional emails
• 5 newsletters & learning resources
• 3 automated system notifications
"You're subscribed to a high volume of marketing lists — consider unsubscribing or filtering."

Additional rules:
- If the ask is buried or unclear, surface it explicitly. Never leave "what they want" ambiguous.
- If two emails are part of the same thread, collapse them into one entry.
- Tone: direct, no filler. Write for someone who has 5 minutes.
- Output length: under 300 words total.
- Start the first line with "Quick 5-minute digest" exactly.`

export async function POST(req: NextRequest) {
  const body = await req.json()
  const emails = body.emails || []
  const anthropicKey = (process as typeof process & {
    env?: { ANTHROPIC_API_KEY?: string }
  }).env?.ANTHROPIC_API_KEY

  if (!Array.isArray(emails) || emails.length === 0) {
    const encoder = new TextEncoder()
    return new Response(encoder.encode("No unread emails were found."), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }

  if (!anthropicKey) {
    const encoder = new TextEncoder()
    return new Response(encoder.encode(summarizeFallback(emails as Array<Record<string, unknown>>)), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }

  const safeEmails = emails as Array<Record<string, unknown>>
  const emailList = safeEmails
    .map((email, i) => {
      const subject = String(email.subject ?? "message")
      const from = String(email.from ?? "someone")
      const preview = String(email.preview ?? "")
      const receivedAt = String(email.receivedAt ?? "")
      return `${i + 1}. Subject: "${subject}" | From: ${from} | Received: ${receivedAt} | Preview: ${preview}`
    })
    .join("\n")

  const client = new Anthropic({ apiKey: anthropicKey })
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = client.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 600,
          // Cache the system prompt — reused across calls within 5-min TTL
          system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: `Emails to triage:\n${emailList}` }],
        })

        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            "delta" in event &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
      } catch {
        controller.enqueue(encoder.encode(summarizeFallback(safeEmails)))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
