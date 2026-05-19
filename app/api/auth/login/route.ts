import { NextResponse } from "next/server"
import { getOAuthAuthorizeUrl } from "@/lib/outlook-oauth"

export async function GET() {
  try {
    const authorizeUrl = getOAuthAuthorizeUrl()
    return NextResponse.redirect(authorizeUrl)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate auth URL" },
      { status: 500 }
    )
  }
}
