import { NextResponse } from "next/server"
import { deleteKey } from "@/lib/local-store"

export async function POST() {
  await deleteKey("__auth_token__")
  return NextResponse.json({ ok: true })
}
