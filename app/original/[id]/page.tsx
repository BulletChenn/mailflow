import Link from "next/link"
import { notFound } from "next/navigation"
import { sampleEmails } from "@/lib/data"
import { getAuthToken } from "@/lib/local-store"
import { fetchEmailById } from "@/lib/outlook-oauth"

type Props = {
  params: Promise<{ id: string }>
}

export default async function OriginalEmailPage({ params }: Props) {
  const { id } = await params
  const decodedId = decodeURIComponent(id)

  let email = sampleEmails.find((item) => item.id === decodedId) ?? null

  if (!email) {
    const authData = await getAuthToken()
    if (authData?.accessToken) {
      email = await fetchEmailById(authData.accessToken, decodedId)
    }
  }

  if (!email) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-8 px-6 py-10 sm:px-10">
        <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/80 p-8 shadow-xl shadow-slate-950/50">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Original message</p>
              <h1 className="mt-2 text-3xl font-medium text-white">{email.subject}</h1>
              <p className="mt-2 text-sm text-slate-400">
                From {email.from} · {email.receivedAt}
              </p>
            </div>
            <Link href="/" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-cyan-200 transition hover:border-cyan-300/50 hover:bg-cyan-500/10 hover:text-white">
              Back to inbox
            </Link>
          </div>

          <div className="rounded-3xl bg-slate-900/90 p-6 text-slate-200 ring-1 ring-white/5">
            <p className="whitespace-pre-wrap text-base leading-8">{email.body}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-slate-200 ring-1 ring-white/5">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Category</p>
              <p className="mt-3 text-base text-white">{email.category}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-slate-200 ring-1 ring-white/5">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Priority</p>
              <p className="mt-3 text-base text-white">{email.urgency}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-slate-200 ring-1 ring-white/5">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Tags</p>
              <p className="mt-3 text-base text-white">{email.tags.join(", ")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
