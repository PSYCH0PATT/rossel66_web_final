/**
 * Брендовая палитра площадок — этап 2.1 UI-overhaul (причина C-04).
 *
 * Цвета площадок раньше жили в трёх местах одного файла
 * `app/dashboard/admin/playlists/page.tsx`: в `getPlatformBadgeStyle()` (строка 40),
 * в карточках сводки (строки 992–1104) и в бейджах таблицы (строки 1186–1206),
 * каждый раз inline-хексом. Плюс те же значения подставляются в URL иконок
 * `cdn.simpleicons.org/<icon>/<hex>` на страницах артистов.
 *
 * Это фирменные цвета чужих брендов, а не тема кабинета: в токены `app/tokens.css`
 * они не идут, но и расползаться по экранам не должны.
 *
 * ЗНАЧЕНИЯ = ТЕКУЩИМ. Модуль создан на этапе 2.1, применение по страницам —
 * волны этапа 4 (docs/ui-audit.md).
 */
import {
  isMtsMusicPlatform,
  isOdnoklassnikiPlatform,
  isSberMusicPlatform,
  isVkMusicPlatform,
  isYandexMusicPlatform,
} from "@/lib/playlist-platform"

export type PlatformBadgeColors = {
  /** Фон бейджа. */
  bg: string
  /** Цвет текста поверх фона — у Яндекса он чёрный, у остальных белый. */
  color: string
  /** Хекс без «#» для `cdn.simpleicons.org/<icon>/<hex>`. */
  icon: string
}

/** Ключ площадки. `unknown` — фолбэк для всего, что не опознали. */
export type PlatformKey = "vk" | "yandex" | "mts" | "sber" | "ok" | "unknown"

export const PLATFORM_BADGE_COLORS: Record<PlatformKey, PlatformBadgeColors> = {
  vk: { bg: "#0077FF", color: "#FFFFFF", icon: "0077FF" },
  yandex: { bg: "#FFCC00", color: "#000000", icon: "FFCC00" },
  mts: { bg: "#E30611", color: "#FFFFFF", icon: "E30611" },
  sber: { bg: "#21A038", color: "#FFFFFF", icon: "21A038" },
  ok: { bg: "#EE8208", color: "#FFFFFF", icon: "EE8208" },
  /** gray-500 — тот же серый, что у неопознанной площадки сейчас. */
  unknown: { bg: "#6b7280", color: "#FFFFFF", icon: "6B7280" },
}

/**
 * Ключ площадки по её названию в любом написании («VK Музыка», «вк», «Yandex Music»).
 * Порядок проверок повторяет `getPlatformBadgeStyle()` со страницы плейлистов.
 *
 * Одно расхождение специально оставлено видимым: страница ловит Одноклассников
 * только по «одноклассник»/«odnoklassniki», а общий предикат из
 * `lib/playlist-platform.ts` — ещё и по «ok». То есть плейлист с названием
 * площадки «OK» на этапе 4 сменит серый бейдж на оранжевый. Это исправление,
 * а не регрессия, но подставлять модуль надо, помня о нём;
 * тест `platform-colors.test.ts` фиксирует поведение.
 */
export function platformKey(platform: string | null | undefined): PlatformKey {
  if (isVkMusicPlatform(platform)) return "vk"
  if (isYandexMusicPlatform(platform)) return "yandex"
  if (isMtsMusicPlatform(platform)) return "mts"
  if (isSberMusicPlatform(platform)) return "sber"
  if (isOdnoklassnikiPlatform(platform)) return "ok"
  return "unknown"
}

/** Цвета бейджа площадки по её названию. */
export function platformBadgeColors(
  platform: string | null | undefined
): PlatformBadgeColors {
  return PLATFORM_BADGE_COLORS[platformKey(platform)]
}
