import CryptoJS from 'crypto-js'

const CryptoSecret = import.meta.env.VITE_CRYPTO_SECRET || '__CRYPTO_SECRET__'

export function enCrypto<T>(data: T): string {
  const str = JSON.stringify(data)
  return CryptoJS.AES.encrypt(str, CryptoSecret).toString()
}

export function deCrypto<T = unknown>(data: string): T | null {
  const bytes = CryptoJS.AES.decrypt(data, CryptoSecret)
  const str = bytes.toString(CryptoJS.enc.Utf8)

  if (str)
    return JSON.parse(str) as T

  return null
}
