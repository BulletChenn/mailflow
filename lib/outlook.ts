import "isomorphic-fetch"
import { Client } from "@microsoft/microsoft-graph-client"

const nodeProcess = process as typeof process & {
  env?: {
    OUTLOOK_TENANT_ID?: string
    OUTLOOK_CLIENT_ID?: string
    OUTLOOK_CLIENT_SECRET?: string
    OUTLOOK_USER_EMAIL?: string
  }
}
const tenantId = nodeProcess.env?.OUTLOOK_TENANT_ID
const clientId = nodeProcess.env?.OUTLOOK_CLIENT_ID
const clientSecret = nodeProcess.env?.OUTLOOK_CLIENT_SECRET
const userEmail = nodeProcess.env?.OUTLOOK_USER_EMAIL

function ensureEnv() {
  if (!tenantId || !clientId || !clientSecret || !userEmail) {
    throw new Error(
      "Missing Outlook environment variables. Set OUTLOOK_TENANT_ID, OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, and OUTLOOK_USER_EMAIL."
    )
  }
}

async function getAccessToken() {
  ensureEnv()

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId!,
      scope: "https://graph.microsoft.com/.default",
      client_secret: clientSecret!,
      grant_type: "client_credentials",
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Unable to fetch Outlook access token: ${body}`)
  }

  const data = await response.json()
  return data.access_token as string
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

export async function fetchUnreadOutlookEmails(): Promise<OutlookEmail[]> {
  const accessToken = await getAccessToken()
  const client = getClient(accessToken)

  const response = await client
    .api(`/users/${encodeURIComponent(userEmail!)}/mailFolders/inbox/messages`)
    .top(20)
    .filter("isRead eq false")
    .select("id,subject,bodyPreview,receivedDateTime,from")
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

    return {
      id: String(message.id ?? ""),
      from: name || address || "Unknown sender",
      fromAddress: address,
      subject,
      preview,
      body: preview,
      receivedAt: receivedDateTime
        ? new Date(receivedDateTime).toLocaleString()
        : "Unknown time",
      urgency: "Medium",
      category: "Outlook",
      originalLink: `https://outlook.office.com/mail/deeplink/compose/${String(message.id ?? "")}`,
      tags: ["Outlook", "Unread"],
    }
  })
}

export async function sendOutlookMessage(to: string, subject: string, body: string) {
  const accessToken = await getAccessToken()
  const client = getClient(accessToken)

  await client.api(`/users/${encodeURIComponent(userEmail!)}/sendMail`).post({
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
