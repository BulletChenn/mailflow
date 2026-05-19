"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight, ChevronDown, CircleMinus, RefreshCw } from "lucide-react"
import type { Email } from "@/lib/data"
import { sampleEmails } from "@/lib/data"


function timeAgo(email: Email): string {
  if (email.receivedDateTime) {
    const diff = Date.now() - new Date(email.receivedDateTime).getTime()
    const mins = Math.floor(diff / 60_000)
    const hours = Math.floor(diff / 3_600_000)
    const days = Math.floor(diff / 86_400_000)
    if (mins < 1) return "Just now"
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days === 1) return "Yesterday"
    if (days < 7) return `${days}d ago`
    return new Date(email.receivedDateTime).toLocaleDateString([], { month: "short", day: "numeric" })
  }
  return email.receivedAt
}

function RadiatingDot({ connected }: { connected: boolean }) {
  const cx = 20, cy = 20, numRays = 32, innerR = 5.5, outerR = 17
  const rays = Array.from({ length: numRays }, (_, i) => {
    const angle = (i * (360 / numRays)) * (Math.PI / 180)
    return {
      x1: +(cx + innerR * Math.sin(angle)).toFixed(2),
      y1: +(cy - innerR * Math.cos(angle)).toFixed(2),
      x2: +(cx + outerR * Math.sin(angle)).toFixed(2),
      y2: +(cy - outerR * Math.cos(angle)).toFixed(2),
    }
  })
  return (
    <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
      {rays.map((r, i) => (
        <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke={connected ? "#1e7a2e" : "#94a3b8"} strokeWidth="1" strokeLinecap="round" />
      ))}
      <circle cx={cx} cy={cy} r={4} fill={connected ? "#1e7a2e" : "#94a3b8"} />
    </svg>
  )
}

function formatDraft(email: Email) {
  const recipient = email.from.split(" ")[0]
  return `Hi ${recipient},\n\nThanks for the note on "${email.subject}." I reviewed the key items and recommend we align on the schedule and deliverables before the deadline. I can also prepare a short version for the stakeholders if that helps.\n\nBest,\n[Your Name]`
}

export default function HomePage() {
  const [emails, setEmails] = useState<Email[]>([])
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [summary, setSummary] = useState(
    "Read, digest, and reply — all within one flow. From swamped to done — no more inbox guilt."
  )
  const [replyDraft, setReplyDraft] = useState("")
  const [status, setStatus] = useState("Ready to generate your summary.")
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null)
  const [generatingDraft, setGeneratingDraft] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [urgentIds, setUrgentIds] = useState<Set<string>>(() => {
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem("mailflow_urgent_ids") : null
      return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>()
    } catch { return new Set<string>() }
  })
  const statusRef = useRef<HTMLDivElement>(null)
  const classifyUrgencyRef = useRef<((emails: Email[]) => Promise<void>) | null>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setPanelOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const loadEmails = async () => {
    try {
      const response = await fetch("/api/emails")
      const result = await response.json()
      const firstEmail = result.emails?.[0] ?? sampleEmails[0]
      const loadedEmails = result.emails ?? sampleEmails
      setEmails(loadedEmails)
      setSelectedEmail(firstEmail)
      void generateDraft(firstEmail)
      setIsSignedIn(!result.warning?.includes("Not signed in"))
      if (result.userEmail) setUserEmail(result.userEmail)
      void classifyUrgency(loadedEmails)
    } catch {
      setEmails(sampleEmails)
      setSelectedEmail(sampleEmails[0])
      setReplyDraft(formatDraft(sampleEmails[0]))
      setIsSignedIn(false)
    }
  }

  useEffect(() => {
    void loadEmails()
  }, [])

  // Background poll every 5 minutes — re-fetches inbox and re-classifies urgency
  // Fully independent of summary generation
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch("/api/emails")
        const result = await response.json()
        if (Array.isArray(result.emails)) {
          setEmails(result.emails as Email[])
          void classifyUrgencyRef.current?.(result.emails as Email[])
        }
      } catch {
        // silent — don't disrupt the user on background poll failure
      }
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const classifyUrgency = async (emailBatch: Email[]) => {
    if (emailBatch.length === 0) return
    try {
      const response = await fetch("/api/urgent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: emailBatch }),
      })
      const { results } = await response.json()
      if (Array.isArray(results)) {
        const ids = new Set<string>(
          results.filter((r: { urgent: boolean; email_id: string }) => r.urgent).map((r: { email_id: string }) => r.email_id)
        )
        setUrgentIds(ids)
        try { localStorage.setItem("mailflow_urgent_ids", JSON.stringify([...ids])) } catch { /* ignore */ }
      }
    } catch (err) {
      console.error("Urgency classification error:", err)
    }
  }

  // Keep ref always pointing to the latest classifyUrgency instance
  useEffect(() => { classifyUrgencyRef.current = classifyUrgency })

  const urgentCount = useMemo(
    () => [...urgentIds].filter((id) => emails.some((e) => e.id === id)).length,
    [urgentIds, emails]
  )

  const generateDraft = async (email: Email) => {
    setGeneratingDraft(true)
    setReplyDraft(formatDraft(email))
    try {
      const response = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: email.subject, body: email.body, from: email.from }),
      })
      const result = await response.json()
      if (result.draft) setReplyDraft(result.draft)
    } catch {
      // formatDraft fallback already set above
    } finally {
      setGeneratingDraft(false)
    }
  }

  const handleGenerateSummary = async () => {
    setStatus("Building your TL;DR...")
    setSummary("")
    try {
      const response = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      })
      if (!response.body) throw new Error("No response body")
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let full = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setSummary(full)
      }
      setLastRefreshed(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }))
      setStatus("TL;DR ready")
    } catch (error) {
      console.error(error)
      setStatus("Unable to generate summary.")
      setSummary("Mailflow could not connect to the summary service.")
    }
  }

  const handleRefreshInbox = async () => {
    setPanelOpen(false)
    await loadEmails()
  }

  const handleDisconnect = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    setIsSignedIn(false)
    setUserEmail(null)
    setEmails(sampleEmails)
    setSelectedEmail(sampleEmails[0])
    setReplyDraft(formatDraft(sampleEmails[0]))
    setPanelOpen(false)
  }

  const handleSaveDraft = async () => {
    if (!selectedEmail) { setStatus("Select an email before saving a draft."); return }
    const response = await fetch("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailId: selectedEmail.id, draft: replyDraft }),
    })
    const result = await response.json()
    setStatus(result.saved ? "Draft saved locally." : "Unable to save draft.")
  }

  const handleMarkRead = async (email: Email) => {
    // Optimistic update — remove from UI immediately
    setUrgentIds((prev) => { const next = new Set(prev); next.delete(email.id); return next })
    const remaining = emails.filter((e) => e.id !== email.id)
    setEmails(remaining)
    if (selectedEmail?.id === email.id) {
      const next = remaining[0] ?? null
      setSelectedEmail(next)
      if (next) void generateDraft(next)
      else setReplyDraft("")
    }
    // Sync with Outlook in background
    try {
      const response = await fetch("/api/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: email.id }),
      })
      const result = await response.json()
      if (!result.ok) console.error("Outlook mark-as-read failed:", result.message)
    } catch (err) {
      console.error("Outlook mark-as-read error:", err)
    }
  }

  const handleSend = async () => {
    if (!selectedEmail) { setStatus("Choose a message before sending."); return }
    const response = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emailId: selectedEmail.id,
        draft: replyDraft,
        to: selectedEmail.fromAddress ?? selectedEmail.from,
        subject: selectedEmail.subject,
      }),
    })
    const result = await response.json()
    setStatus(result.message || "Reply queued locally.")
    if (result.ok) {
      setUrgentIds((prev) => { const next = new Set(prev); next.delete(selectedEmail.id); return next })
      const remaining = emails.filter((e) => e.id !== selectedEmail.id)
      setEmails(remaining)
      const next = remaining[0] ?? null
      setSelectedEmail(next)
      if (next) void generateDraft(next)
      else setReplyDraft("")
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-bg-primary)" }}>
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 px-6 py-5 md:px-10">

        {/* Header */}
        <header className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.35em]" style={{ color: "var(--color-accent-primary)" }}>Mailflow</p>

          {/* Summary + status bar row */}
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 text-sm font-normal leading-6">
              <button
                type="button"
                onClick={() => setSummaryOpen((v) => !v)}
                className="mb-1 inline-flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-70"
                style={{ color: "#1e7a2e" }}
              >
                <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${summaryOpen ? "" : "-rotate-90"}`} />
                {summaryOpen ? "Hide" : "Show"}
              </button>
              {summaryOpen && (
                summary.includes("Quick 5-minute digest") ? (
                  <div className="space-y-1">
                    {summary.split("\n").map((line, i) => {
                      if (!line.trim()) return null
                      if (i === 0) return <p key={i} className="font-medium" style={{ color: "var(--color-text-primary)" }}>{line}</p>
                      return <p key={i} style={{ color: "var(--color-text-subtle)" }}>{line}</p>
                    })}
                  </div>
                ) : (
                  <p style={{ color: "#6b9e7a" }}>
                    {summary.includes("From swamped") ? (
                      <>
                        {summary.split("From swamped")[0]}
                        <span className="inline-block">From swamped{summary.split("From swamped")[1]}</span>
                      </>
                    ) : summary}
                  </p>
                )
              )}
            </div>

          {/* Status bar */}
          <div className="relative flex shrink-0 items-center gap-5" ref={statusRef}>

            {/* TL;DR All pill button */}
            <button
              type="button"
              onClick={() => void handleGenerateSummary()}
              className="hidden items-center gap-1.5 rounded-full bg-transparent px-[14px] py-[6px] font-medium transition hover:bg-slate-50 sm:flex"
              style={{
                fontSize: "14px",
                border: "1.5px solid var(--color-text-subtle)",
                color: "var(--color-text-primary)",
              }}
            >
              <RefreshCw style={{ width: 14, height: 14 }} />
              TL;DR All
            </button>

            {/* Separator */}
            <div className="hidden h-8 w-px sm:block" style={{ backgroundColor: "var(--color-text-subtle)", opacity: 0.4 }} />

            {/* Stats */}
            <div className="hidden items-center gap-6 sm:flex">
              <div className="text-right">
                <p className="font-medium leading-none" style={{ fontSize: 22, color: "var(--color-text-primary)" }}>{emails.length}</p>
                <p className="mt-1 uppercase" style={{ fontSize: 11, letterSpacing: "0.06em", color: "var(--color-text-subtle)" }}>Unread</p>
              </div>
              <div className="text-right">
                <p className="font-medium leading-none" style={{ fontSize: 22, color: urgentCount > 0 ? "#c0392b" : "var(--color-text-primary)" }}>
                  {urgentCount}
                </p>
                <p className="mt-1 uppercase" style={{ fontSize: 11, letterSpacing: "0.06em", color: "var(--color-text-subtle)" }}>Urgent</p>
              </div>
            </div>

            {/* Separator */}
            <div className="hidden h-8 w-px sm:block" style={{ backgroundColor: "var(--color-text-subtle)", opacity: 0.4 }} />

            {/* Connection icon — 34px circle */}
            <div className="group relative">
              <button
                type="button"
                onClick={() => setPanelOpen((v) => !v)}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full transition hover:opacity-70"
                aria-label="Account status"
              >
                <RadiatingDot connected={isSignedIn} />
              </button>
              {/* Hover tooltip */}
              {!panelOpen && (
                <span className="pointer-events-none absolute right-0 top-10 z-50 hidden whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-xl group-hover:block font-normal">
                  {userEmail ?? "Not connected"}
                </span>
              )}
            </div>

            {/* Click panel */}
            {panelOpen && (
              <div className="absolute right-0 top-10 z-50 w-60 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
                <p className="text-xs font-normal text-slate-400">Connected account</p>
                <p className="mt-1 truncate text-sm font-medium text-slate-900">
                  {userEmail ?? "Not signed in"}
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleRefreshInbox}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-sm font-normal text-slate-700 transition hover:bg-slate-50"
                  >
                    Refresh inbox
                  </button>
                  {isSignedIn ? (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="w-full rounded-xl border border-red-200 px-3 py-2 text-left text-sm font-normal text-red-500 transition hover:bg-red-50"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { window.location.href = "/api/auth/login" }}
                      className="w-full rounded-xl border border-red-200 px-3 py-2 text-left text-sm font-normal text-red-500 transition hover:bg-red-50"
                    >
                      Connect Outlook
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          </div>
        </header>

        {/* Glimpse */}
        <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-medium text-slate-900">Glimpse</h2>
            {lastRefreshed && (
              <p className="text-xs font-normal text-slate-400">Last refreshed {lastRefreshed}</p>
            )}
          </div>
          {/* Unified email card feed */}
          <div className="relative">
            <div className={`space-y-1 overflow-y-auto scroll-smooth pr-0.5 ${emails.length > 3 ? "max-h-[420px]" : ""}`}>
              {emails.map((email) => {
                const isSelected = selectedEmail?.id === email.id
                const isUrgent = urgentIds.has(email.id)
                return (
                  <div key={email.id} className="flex overflow-hidden rounded-2xl">
                    {/* Left accent */}
                    <div className={`w-[3px] shrink-0 transition-colors ${isSelected ? "bg-slate-800" : isUrgent ? "bg-red-400" : "bg-slate-200"}`} />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEmail(email)
                        setStatus(`Selected "${email.subject}" for reply.`)
                        void generateDraft(email)
                      }}
                      className={`flex-1 p-3 text-left transition duration-150 ${isSelected ? "bg-slate-50" : "bg-white hover:bg-slate-50"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="truncate text-sm font-medium leading-5 text-slate-900">{email.subject}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {isUrgent && <span className="h-1.5 w-1.5 rounded-full bg-red-400" />}
                          <span className="text-[0.65rem] font-normal text-slate-400">{timeAgo(email)}</span>
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-normal text-slate-400">From {email.from}</p>
                      <p className="mt-1 text-xs font-normal leading-5 text-slate-500 line-clamp-2">{email.preview}</p>
                      <a
                        href={email.originalLink}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(email.originalLink, "_blank", "popup,width=1100,height=750,scrollbars=yes") }}
                        className="mt-2 inline-flex items-center gap-1 text-[0.65rem] font-normal text-slate-400 transition-colors hover:text-slate-600"
                      >
                        <ArrowRight className="h-2.5 w-2.5" />
                        View original
                      </a>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleMarkRead(email) }}
                      title="Mark as read — no action needed"
                      className="flex shrink-0 items-center self-stretch px-3 text-slate-300 transition-colors hover:text-slate-500 active:scale-90"
                    >
                      <CircleMinus className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
            {/* Bottom fade when scrollable */}
            {emails.length > 3 && (
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 rounded-b-2xl bg-gradient-to-t from-white to-transparent" />
            )}
          </div>
        </section>

        {/* Reply */}
        <section className="-mt-2 space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-medium" style={{ color: "var(--color-text-primary)" }}>Reply</h2>
            <button
              type="button"
              onClick={() => selectedEmail && void generateDraft(selectedEmail)}
              disabled={generatingDraft || !selectedEmail}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-400 transition hover:border-slate-400 hover:text-slate-600 disabled:opacity-40"
            >
              <RefreshCw className={`h-3 w-3 ${generatingDraft ? "animate-spin" : ""}`} />
              {generatingDraft ? "Generating…" : "Regenerate"}
            </button>
          </div>
          <div className="grid gap-3">
            <textarea
              value={replyDraft}
              onChange={(event) => setReplyDraft(event.target.value)}
              rows={6}
              className="min-h-[185px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">{status}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 outline-none transition-all duration-150 hover:border-[#00e676] hover:bg-[#00e676]/10 hover:text-[#00a550] focus-visible:ring-2 focus-visible:ring-[#00e676]/40 active:scale-95 active:bg-[#00e676]/20 disabled:pointer-events-none disabled:opacity-40"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  className="h-8 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white outline-none transition-all duration-150 hover:bg-[#00e676] hover:text-slate-900 hover:shadow-[0_0_12px_2px_rgba(0,230,118,0.35)] focus-visible:ring-2 focus-visible:ring-[#00e676]/50 active:scale-95 active:bg-[#00c864] disabled:pointer-events-none disabled:opacity-40"
                >
                  Send reply
                </button>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
