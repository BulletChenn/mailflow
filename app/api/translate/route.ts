import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const anthropicKey = (process as typeof process & { env?: { ANTHROPIC_API_KEY?: string } }).env
  ?.ANTHROPIC_API_KEY

export async function POST(req: NextRequest) {
  const { subject, body, targetLanguage } = await req.json()

  if (!subject && !body) {
    return NextResponse.json({ subject: "", body: "" })
  }

  if (!anthropicKey) {
    return NextResponse.json({ subject, body })
  }

  try {
    const client = new Anthropic({ apiKey: anthropicKey })
    const langName =
      targetLanguage === "zh" ? "Simplified Chinese" : targetLanguage === "es" ? "Spanish" : "English"

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Translate the following email subject and body into ${langName}. Return ONLY a JSON object with "subject" and "body" keys — no markdown, no explanation.

Subject: ${subject}
Body: ${body}`,
        },
      ],
    })

    const raw = response.content.map((b) => ("text" in b ? b.text : "")).join("")
    const parsed = JSON.parse(raw) as { subject?: string; body?: string }
    return NextResponse.json({
      subject: parsed.subject ?? subject,
      body: parsed.body ?? body,
    })
  } catch {
    return NextResponse.json({ subject, body })
  }
}
