/**
 * Простое логирование с маскированием очевидных секретов в строках.
 * Для продакшена предпочтительны Sentry + структурные логи.
 */

const SENSITIVE_KEYS = /password|secret|token|authorization|bearer|apikey|api_key/i

function redactValue(v: unknown): unknown {
  if (v == null) return v
  if (typeof v === "string") {
    if (v.length > 12 && (/^[A-Za-z0-9+/=_-]{16,}$/.test(v) || SENSITIVE_KEYS.test(v))) {
      return "[redacted]"
    }
    return v
  }
  if (typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(o)) {
      out[k] = SENSITIVE_KEYS.test(k) ? "[redacted]" : redactValue(val)
    }
    return out
  }
  if (Array.isArray(v)) return v.map(redactValue)
  return v
}

export const log = {
  info: (...args: unknown[]) => console.log(...args.map(redactValue)),
  warn: (...args: unknown[]) => console.warn(...args.map(redactValue)),
  error: (...args: unknown[]) => console.error(...args.map(redactValue)),
}
