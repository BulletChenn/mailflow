import { NextRequest, NextResponse } from "next/server"
import { getAuthToken, saveDraft } from "@/lib/local-store"
import { markMessageAsRead, refreshAccessToken } from "@/lib/outlook-oauth"

export async function POST(req: NextRequest) {
  const { emailId } = await req.json()
  if (!emailId) {
    return NextResponse.json({ error: "emailId is required" }, { status: 400 })
  }

  let authData = await getAuthToken()
  if (!authData?.accessToken) {
    return NextResponse.json({ ok: false, message: "Not signed in." })
  }

  if (authData.expiresAt < Date.now() + 60_000) {
    if (!authData.refreshToken) {
      return NextResponse.json({ ok: false, message: "Session expired. Please sign in again." })
    }
    try {
      const refreshed = await refreshAccessToken(authData.refreshToken)
      authData = {
        accessToken: refreshed.access_token,
        refreshToken: authData.refreshToken,
        expiresAt: Date.now() + refreshed.expires_in * 1000,
      }
      await saveDraft("__auth_token__", JSON.stringify(authData))
    } catch {
      return NextResponse.json({ ok: false, message: "Session expired. Please sign in again." })
    }
  }

  try {
    await markMessageAsRead(authData.accessToken, emailId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Mark as read failed — Graph API error:", msg)
    return NextResponse.json({ ok: false, message: msg })
  }
}
