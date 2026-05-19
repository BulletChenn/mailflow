import "isomorphic-fetch"
import { Client } from "@microsoft/microsoft-graph-client"

const nodeProcess = process as typeof process & {
  env?: {
    OUTLOOK_CLIENT_ID?: string
    OUTLOOK_CLIENT_SECRET?: string
    OUTLOOK_REDIRECT_URI?: string
  }
}
const clientId = nodeProcess.env?.OUTLOOK_CLIENT_ID
const clientSecret = nodeProcess.env?.OUTLOOK_CLIENT_SECRET
const redirectUri = nodeProcess.env?.OUTLOOK_REDIRECT_URI || "http://localhost:3000/api/auth/callback"

export function getOAuthAuthorizeUrl(): string {
  if (!clientId) {
    throw new Error("OUTLOOK_CLIENT_ID is required")
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope:
      "https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send offline_access",
    response_mode: "query",
  })

  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
}

export async function getAccessTokenFromCode(code: string): Promise<{
  access_token: string
  refresh_token?: string
  expires_in: number
}> {
  if (!clientId || !clientSecret) {
    throw new Error("OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET are required")
  }

  const tokenUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`OAuth token exchange failed: ${body}`)
  }

  const data = await response.json()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in || 3600,
  }
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number }> {
  if (!clientId || !clientSecret) {
    throw new Error("OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET are required")
  }

  const tokenUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Token refresh failed: ${body}`)
  }

  const data = await response.json()
  return {
    access_token: data.access_token,
    expires_in: data.expires_in || 3600,
  }
}

function getClient(accessToken: string) {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken)
    },
  })
}

export type OutlookEmail = {
  id: string
  from: string
  fromAddress?: string
  subject: string
  preview: string
  body: string
  receivedAt: string
  urgency: "High" | "Medium" | "Low"
  category: string
  originalLink: string
  tags: string[]
}

export async function fetchInboxOwnerEmail(accessToken: string): Promise<string | null> {
  try {
    const client = getClient(accessToken)
    // Sent Items is reliable — the `from` field is always the authenticated user
    const response = await client
      .api("/me/mailFolders/sentItems/messages")
      .top(1)
      .select("from")
      .get() as { value?: Array<{ from?: { emailAddress?: { address?: string } } }> }
    const email = response.value?.[0]?.from?.emailAddress?.address ?? null
    if (email) return email

    // Fallback: check toRecipients of inbox if sent items is empty
    const fallback = await client
      .api("/me/messages")
      .top(1)
      .select("toRecipients")
      .get() as { value?: Array<{ toRecipients?: Array<{ emailAddress?: { address?: string } }> }> }
    return fallback.value?.[0]?.toRecipients?.[0]?.emailAddress?.address ?? null
  } catch {
    return null
  }
}

export async function fetchUnreadOutlookEmails(accessToken: string): Promise<OutlookEmail[]> {
  const client = getClient(accessToken)

  const response = await client
    .api("/me/mailFolders/inbox/messages")
    .top(20)
    .filter("isRead eq false")
    .select("id,subject,bodyPreview,body,receivedDateTime,from,webLink")
    .orderby("receivedDateTime desc")
    .get()

  const responseBody = response as { value?: unknown[] }
  const messages = responseBody.value ?? []

  return messages.map((messageItem) => {
    const message = messageItem as Record<string, unknown>
    const from = message.from as Record<string, unknown> | undefined
    const emailAddress = from?.emailAddress as Record<string, unknown> | undefined
    const address = emailAddress?.address as string | undefined
    const name = emailAddress?.name as string | undefined
    const subject = (message.subject as string) ?? "Untitled"
    const preview = (message.bodyPreview as string) ?? "No preview available."
    const receivedDateTime = message.receivedDateTime as string | undefined
    const bodyObj = message.body as { contentType?: string; content?: string } | undefined
    const rawBody = bodyObj?.content ?? preview
    const fullBody = bodyObj?.contentType === "html"
      ? rawBody.replace(/<[^>]*>/g, " ").replace(/\s{2,}/g, " ").trim()
      : rawBody

    return {
      id: String(message.id ?? ""),
      from: name || address || "Unknown sender",
      fromAddress: address,
      subject,
      preview,
      body: fullBody,
      receivedAt: receivedDateTime ? new Date(receivedDateTime).toLocaleString() : "Unknown time",
      receivedDateTime: receivedDateTime ?? undefined,
      urgency: "Medium",
      category: "Outlook",
      originalLink: (message.webLink as string) ?? `/original/${encodeURIComponent(String(message.id ?? ""))}`,
      tags: ["Outlook", "Unread"],
    }
  })
}

export async function fetchEmailById(accessToken: string, id: string): Promise<OutlookEmail | null> {
  try {
    const client = getClient(accessToken)
    const message = await client
      .api(`/me/messages/${id}`)
      .select("id,subject,bodyPreview,body,receivedDateTime,from,webLink")
      .get() as Record<string, unknown>

    const from = message.from as Record<string, unknown> | undefined
    const emailAddress = from?.emailAddress as Record<string, unknown> | undefined
    const address = emailAddress?.address as string | undefined
    const name = emailAddress?.name as string | undefined
    const subject = (message.subject as string) ?? "Untitled"
    const preview = (message.bodyPreview as string) ?? ""
    const receivedDateTime = message.receivedDateTime as string | undefined
    const bodyObj = message.body as { contentType?: string; content?: string } | undefined
    const rawBody = bodyObj?.content ?? preview
    const fullBody = bodyObj?.contentType === "html"
      ? rawBody.replace(/<[^>]*>/g, " ").replace(/\s{2,}/g, " ").trim()
      : rawBody

    return {
      id: String(message.id ?? ""),
      from: name || address || "Unknown sender",
      fromAddress: address,
      subject,
      preview,
      body: fullBody,
      receivedAt: receivedDateTime ? new Date(receivedDateTime).toLocaleString() : "Unknown time",
      urgency: "Medium",
      category: "Outlook",
      originalLink: (message.webLink as string) ?? `/original/${encodeURIComponent(String(message.id ?? ""))}`,
      tags: ["Outlook", "Unread"],
    }
  } catch {
    return null
  }
}

export async function sendOutlookMessage(
  accessToken: string,
  to: string,
  subject: string,
  body: string
) {
  const client = getClient(accessToken)

  await client.api("/me/sendMail").post({
    message: {
      subject,
      body: {
        contentType: "Text",
        content: body,
      },
      toRecipients: [
        {
          emailAddress: { address: to },
        },
      ],
    },
    saveToSentItems: true,
  })
}

export async function markMessageAsRead(accessToken: string, messageId: string): Promise<void> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isRead: true }),
    }
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Mark as read failed: ${res.status} ${body}`)
  }
}
