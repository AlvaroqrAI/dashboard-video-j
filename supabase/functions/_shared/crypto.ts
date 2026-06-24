// Cifrado simétrico AES-GCM para guardar la API Key de Retell en reposo.
// La clave maestra vive en la variable de entorno APP_ENCRYPTION_KEY
// (32 bytes en base64). Genera una con: openssl rand -base64 32

const enc = new TextEncoder()
const dec = new TextDecoder()

async function getKey(): Promise<CryptoKey> {
  const raw = Deno.env.get('APP_ENCRYPTION_KEY')
  if (!raw) throw new Error('Falta APP_ENCRYPTION_KEY')
  const keyBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext),
  )
  // Formato: base64(iv) . base64(ciphertext)
  const b64 = (buf: ArrayBuffer | Uint8Array) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
  return `${b64(iv)}.${b64(cipher)}`
}

export async function decrypt(payload: string): Promise<string> {
  const key = await getKey()
  const [ivB64, dataB64] = payload.split('.')
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0))
  const data = Uint8Array.from(atob(dataB64), (c) => c.charCodeAt(0))
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return dec.decode(plain)
}
