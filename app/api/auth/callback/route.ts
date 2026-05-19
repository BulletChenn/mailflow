import { NextRequest, NextResponse } from "next/server"
import { getAccessTokenFromCode } from "@/lib/outlook-oauth"
import { saveDraft } from "@/lib/local-store"

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  const error = req.nextUrl.searchParams.get("error")

  if (error) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error)}`, req.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", req.url))
  }

  try {
    const { access_token, refresh_token, expires_in } = await getAccessTokenFromCode(code)

    const tokenData = JSON.stringify({
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + expires_in * 1000,
    })

    await saveDraft("__auth_token__", tokenData)

    return NextResponse.redirect(new URL("/?auth=success", req.url))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(message)}`, req.url)
    )
  }
}
