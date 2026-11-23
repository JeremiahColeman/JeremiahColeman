/**
 * Returns a same-site path to send someone to after sign-in, or the fallback.
 * Rejects absolute URLs and protocol-relative paths ("//evil.com", "/\evil.com").
 */
export function safeNext(value: unknown, fallback = "/lists"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
