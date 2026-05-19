import { NextRequest, NextResponse } from "next/server"
import { getDraft, saveDraft } from "@/lib/local-store"

export async function GET(req: NextRequest) {
  const emailId = req.nextUrl.searchParams.get("emailId")
  if (!emailId) {
    return NextResponse.json({ draft: null })
  }

  const draft = await getDraft(emailId)
  return NextResponse.json({ draft })
}

export async function POST(req: NextRequest) {
  const { emailId, draft } = await req.json()
  if (!emailId || !draft) {
    return NextResponse.json({ error: "emailId and draft are required" }, { status: 400 })
  }

  const saved = await saveDraft(emailId, draft)
  return NextResponse.json({ saved })
}
