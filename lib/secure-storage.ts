import CryptoJS from "crypto-js"

const STORAGE_KEY = (process as typeof process & {
  env?: { STORAGE_KEY?: string }
}).env?.STORAGE_KEY ?? "mailflow-local-key"

export function encrypt(value: string) {
  return CryptoJS.AES.encrypt(value, STORAGE_KEY).toString()
}

export function decrypt(cipher: string) {
  if (!cipher) {
    return ""
  }

  const bytes = CryptoJS.AES.decrypt(cipher, STORAGE_KEY)
  return bytes.toString(CryptoJS.enc.Utf8) || ""
}
