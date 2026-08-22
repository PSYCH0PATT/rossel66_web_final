/**
 * Хосты, которым разрешено ходить через next/image (`images.remotePatterns`
 * в `next.config.mjs`). Картинка с любого другого хоста не «просто медленно
 * грузится» — оптимизатор отвечает 400, и на экране остаётся битая иконка с
 * alt-текстом (F-06: вся секция «Яндекс Музыка» в админ-плейлистах).
 *
 * Список продублирован здесь, потому что `next.config.mjs` — ESM-конфиг сборки
 * и импортировать его в рантайм-код нельзя. От расхождения стережёт
 * `lib/next-image-hosts.test.ts`: он читает конфиг и сверяет списки.
 */
export const NEXT_IMAGE_REMOTE_HOSTS = [
  'v0.blob.com',
  'hebbkx1anhila5yf.public.blob.vercel-storage.com',
  '**.userapi.com',
  'media.zvonkodigital.ru',
  'avatars.yandex.net',
  'avatars.mds.yandex.net',
  '**.akamaized.net',
  'example.com',
  '**.supabase.co',
] as const

/** Матчинг по правилам Next: `**.` — любые поддомены, `*.` — ровно один уровень. */
function hostMatchesPattern(hostname: string, pattern: string): boolean {
  const host = hostname.toLowerCase()
  const p = pattern.toLowerCase()

  if (p.startsWith('**.')) {
    const suffix = p.slice(2) // '.userapi.com'
    return host.endsWith(suffix) && host.length > suffix.length
  }
  if (p.startsWith('*.')) {
    const suffix = p.slice(1)
    if (!host.endsWith(suffix)) return false
    const label = host.slice(0, host.length - suffix.length)
    return label.length > 0 && !label.includes('.')
  }
  return host === p
}

/** Отдаст ли next/image картинку с этого хоста. */
export function isNextImageRemoteHostAllowed(hostname: string): boolean {
  if (!hostname) return false
  return NEXT_IMAGE_REMOTE_HOSTS.some((pattern) => hostMatchesPattern(hostname, pattern))
}
