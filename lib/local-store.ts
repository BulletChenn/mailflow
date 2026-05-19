import fs from "fs/promises"
import path from "path"
import { decrypt, encrypt } from "./secure-storage"

type StoredData = {
  drafts: Record<string, string>
  settings: Record<string, unknown>
}

const dataDir = path.join((process as typeof process & { cwd?: () => string }).cwd?.() ?? ".", "data")
const storagePath = path.join(dataDir, "storage.json")

async function ensureStorage() {
  await fs.mkdir(dataDir, { recursive: true })
  try {
    await fs.access(storagePath)
  } catch {
    await fs.writeFile(storagePath, JSON.stringify({ drafts: {}, settings: {} } as StoredData, null, 2), "utf8")
  }
}

async function readStore(): Promise<StoredData> {
  await ensureStorage()
  try {
    const raw = await fs.readFile(storagePath, "utf8")
    return JSON.parse(raw) as StoredData
  } catch {
    return { drafts: {}, settings: {} }
  }
}

async function writeStore(store: StoredData) {
  await ensureStorage()
  await fs.writeFile(storagePath, JSON.stringify(store, null, 2), "utf8")
}

export async function saveDraft(emailId: string, draft: string) {
  const store = await readStore()
  store.drafts[emailId] = encrypt(draft)
  await writeStore(store)
  return { emailId, savedAt: new Date().toISOString() }
}

export async function getDraft(emailId: string) {
  const store = await readStore()
  const cipher = store.drafts[emailId]
  return cipher ? decrypt(cipher) : null
}

export async function deleteKey(key: string) {
  const store = await readStore()
  delete store.drafts[key]
  await writeStore(store)
}

export async function getAuthToken() {
  const encrypted = await getDraft("__auth_token__")
  if (!encrypted) return null
  try {
    return JSON.parse(encrypted) as {
      accessToken: string
      refreshToken?: string
      expiresAt: number
    }
  } catch {
    return null
  }
}
