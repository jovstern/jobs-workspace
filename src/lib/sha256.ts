// SHA-256 of a string's UTF-8 bytes as 64 lower-case hex characters. Uses the browser's built-in
// crypto; no library.
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
