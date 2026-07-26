/**
 * Определение платформы плейлиста по её названию.
 *
 * Названия в CSV приходят в разных написаниях («VK Музыка», «VK Music», «вк»,
 * «Яндекс.Музыка», «Yandex Music»), поэтому сравнивать строго нельзя —
 * только по ключевым словам, без учёта регистра.
 */

export function normalizePlatform(platform: string | null | undefined): string {
  return (platform || "").trim().toLowerCase()
}

export function isVkMusicPlatform(platform: string | null | undefined): boolean {
  const n = normalizePlatform(platform)
  return n.includes("vk") || n.includes("вк")
}

export function isYandexMusicPlatform(platform: string | null | undefined): boolean {
  const n = normalizePlatform(platform)
  return n.includes("yandex") || n.includes("яндекс")
}

export function isMtsMusicPlatform(platform: string | null | undefined): boolean {
  const n = normalizePlatform(platform)
  return n.includes("mts") || n.includes("мтс")
}

export function isSberMusicPlatform(platform: string | null | undefined): boolean {
  const n = normalizePlatform(platform)
  return n.includes("sber") || n.includes("сбер")
}

export function isOdnoklassnikiPlatform(platform: string | null | undefined): boolean {
  const n = normalizePlatform(platform)
  return n.includes("однокласс") || n.includes("odnoklass") || n === "ok" || n.startsWith("ok ")
}
