import { NextRequest, NextResponse } from "next/server"
import { saveDraft, getAuthToken, deleteKey } from "@/lib/local-store"
import { sendOutlookMessage, markMessageAsRead, refreshAccessToken } from "@/lib/outlook-oauth"

export async function POST(req: NextRequest) {
  const { emailId, draft, to, subject } = await req.json()
  if (!emailId || !draft) {
    return NextResponse.json({ error: "emailId and draft are required" }, { status: 400 })
  }

  await saveDraft(emailId, draft)

  if (to && subject) {
    let authData = await getAuthToken()
    if (!authData?.accessToken) {
      return NextResponse.json({ ok: false, message: "Not signed in to Outlook. Draft saved locally." })
    }

    // Refresh token if expired (with 60s buffer)
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
        await deleteKey("__auth_token__")
        return NextResponse.json({ ok: false, message: "Session expired. Please sign in again." })
      }
    }

    try {
      await sendOutlookMessage(authData.accessToken, to, subject, draft)
    } catch (error) {
      console.error("Outlook send failed:", error)
      return NextResponse.json({
        ok: false,
        message: "Draft saved locally, but sending through Outlook failed. Try again later.",
      })
    }

    // Mark as read separately — failure here should not affect the send result
    try {
      await markMessageAsRead(authData.accessToken, emailId)
    } catch (error) {
      console.error("Mark as read failed:", error)
    }

    return NextResponse.json({ ok: true, message: "Reply sent and email marked as read." })
  }

  return NextResponse.json({
    ok: true,
    message: "Your reply is saved locally. Add recipient and subject to send through Outlook when ready.",
  })
}
