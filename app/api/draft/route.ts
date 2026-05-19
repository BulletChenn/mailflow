import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const anthropicKey = (process as typeof process & { env?: { ANTHROPIC_API_KEY?: string } }).env
  ?.ANTHROPIC_API_KEY

export async function POST(req: NextRequest) {
  const { subject, body, from } = await req.json()

  if (!anthropicKey) {
    return NextResponse.json({ draft: null })
  }

  try {
    const client = new Anthropic({ apiKey: anthropicKey })
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `You are helping someone write a professional email reply. Write only the body of the reply — no subject line, no headers, no metadata. Be concise and context-aware. Do not use placeholder text like [Your Name] — end with just "Best," on its own line.

From: ${from}
Subject: ${subject}
Message: ${body}

Reply body only:`,
        },
      ],
    })

    const draft = response.content.map((b) => ("text" in b ? b.text : "")).join("").trim()
    return NextResponse.json({ draft })
  } catch (error) {
    console.error("Draft generation failed:", error)
    return NextResponse.json({ draft: null })
  }
}
