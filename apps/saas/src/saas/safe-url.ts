/** Only http(s) addresses may reach an href or src from stored data; anything else (javascript:, data:) becomes undefined. */
export function safeHttpUrl(v: string | null | undefined): string | undefined {
  if (!v) return undefined
  try { const u = new URL(v); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined } catch { return undefined }
}
