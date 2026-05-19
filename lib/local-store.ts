import { decrypt, encrypt } from "./secure-storage"

// Redis (Upstash) — used when UPSTASH_REDIS_REST_URL is set (production / Vercel)
// Falls back to local file storage for local development
const useRedis = !!(process as typeof process & { env?: Record<string, string> }).env?.UPSTASH_REDIS_REST_URL

async function redisSet(key: string, value: string): Promise<void> {
  const { Redis } = await import("@upstash/redis")
  const redis = new Redis({
    url: (process as typeof process & { env?: Record<string, string> }).env!.UPSTASH_REDIS_REST_URL!,
    token: (process as typeof process & { env?: Record<string, string> }).env!.UPSTASH_REDIS_REST_TOKEN!,
  })
  await redis.set(`mailflow:${key}`, value)
}

async function redisGet(key: string): Promise<string | null> {
  const { Redis } = await import("@upstash/redis")
  const redis = new Redis({
    url: (process as typeof process & { env?: Record<string, string> }).env!.UPSTASH_REDIS_REST_URL!,
    token: (process as typeof process & { env?: Record<string, string> }).env!.UPSTASH_REDIS_REST_TOKEN!,
  })
  return redis.get<string>(`mailflow:${key}`)
}

async function redisDel(key: string): Promise<void> {
  const { Redis } = await import("@upstash/redis")
  const redis = new Redis({
    url: (process as typeof process & { env?: Record<string, string> }).env!.UPSTASH_REDIS_REST_URL!,
    token: (process as typeof process & { env?: Record<string, string> }).env!.UPSTASH_REDIS_REST_TOKEN!,
  })
  await redis.del(`mailflow:${key}`)
}

// Local file storage — development fallback
import fs from "fs/promises"
import path from "path"

type StoredData = { drafts: Record<string, string>; settings: Record<string, unknown> }
const dataDir = path.join((process as typeof process & { cwd?: () => string }).cwd?.() ?? ".", "data")
const storagePath = path.join(dataDir, "storage.json")

async function ensureStorage() {
  await fs.mkdir(dataDir, { recursive: true })
  try { await fs.access(storagePath) }
  catch { await fs.writeFile(storagePath, JSON.stringify({ drafts: {}, settings: {} }), "utf8") }
}

async function readStore(): Promise<StoredData> {
  await ensureStorage()
  try { return JSON.parse(await fs.readFile(storagePath, "utf8")) as StoredData }
  catch { return { drafts: {}, settings: {} } }
}

async function writeStore(store: StoredData) {
  await ensureStorage()
  await fs.writeFile(storagePath, JSON.stringify(store, null, 2), "utf8")
}

// Public API — same interface regardless of backend

export async function saveDraft(emailId: string, draft: string) {
  const encrypted = encrypt(draft)
  if (useRedis) {
    await redisSet(emailId, encrypted)
  } else {
    const store = await readStore()
    store.drafts[emailId] = encrypted
    await writeStore(store)
  }
  return { emailId, savedAt: new Date().toISOString() }
}

export async function getDraft(emailId: string): Promise<string | null> {
  let cipher: string | null
  if (useRedis) {
    cipher = await redisGet(emailId)
  } else {
    const store = await readStore()
    cipher = store.drafts[emailId] ?? null
  }
  return cipher ? decrypt(cipher) : null
}

export async function deleteKey(key: string) {
  if (useRedis) {
    await redisDel(key)
  } else {
    const store = await readStore()
    delete store.drafts[key]
    await writeStore(store)
  }
}

export async function getAuthToken() {
  const encrypted = await getDraft("__auth_token__")
  if (!encrypted) return null
  try {
    return JSON.parse(encrypted) as {
      accessToken: string
      refreshToken?: string
      expiresAt: number
      userEmail?: string | null
    }
  } catch {
    return null
  }
}
