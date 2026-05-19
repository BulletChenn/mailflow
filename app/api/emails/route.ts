import { NextResponse } from "next/server"
import { sampleEmails } from "@/lib/data"
import { fetchUnreadOutlookEmails, refreshAccessToken } from "@/lib/outlook-oauth"
import { getAuthToken, saveDraft } from "@/lib/local-store"

export async function GET() {
  try {
    let authData = await getAuthToken()
    if (!authData?.accessToken) {
      return NextResponse.json({
        emails: sampleEmails,
        warning: "Not signed in. Showing sample emails. Click 'Sign in' to connect your Outlook inbox.",
      })
    }

    // Refresh token if expired (with 60s buffer)
    if (authData.expiresAt < Date.now() + 60_000) {
      if (!authData.refreshToken) {
        return NextResponse.json({
          emails: sampleEmails,
          warning: "Not signed in. Showing sample emails. Click 'Sign in' to connect your Outlook inbox.",
        })
      }
      try {
        const refreshed = await refreshAccessToken(authData.refreshToken)
        authData = {
          accessToken: refreshed.access_token,
          refreshToken: authData.refreshToken,
          expiresAt: Date.now() + refreshed.expires_in * 1000,
          userEmail: authData.userEmail,
        }
        await saveDraft("__auth_token__", JSON.stringify(authData))
      } catch {
        return NextResponse.json({
          emails: sampleEmails,
          warning: "Not signed in. Showing sample emails. Click 'Sign in' to connect your Outlook inbox.",
        })
      }
    }

    try {
      const emails = await fetchUnreadOutlookEmails(authData.accessToken)
      return NextResponse.json({ emails, userEmail: authData.userEmail ?? null })
    } catch (error) {
      console.error("Outlook fetch failed:", error)
      return NextResponse.json({
        emails: sampleEmails,
        warning: "Unable to fetch Outlook inbox. Showing sample data.",
      })
    }
  } catch (error) {
    console.error("Auth check failed:", error)
    return NextResponse.json({ emails: sampleEmails })
  }
}
