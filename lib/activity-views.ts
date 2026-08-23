/**
 * Виды журнала событий — решение 0-б (docs/ia-decisions.md).
 *
 * Владельцу из ~470 записей журнала нужны три вещи: добавился плейлист, артист
 * подписал/ознакомился с отчётом, что-то сломалось. Остальное — обновления
 * профилей «Системой», кроновые добавления релизов, служебный шум — не
 * удаляется, а живёт под видом «Все события».
 *
 * Оговорка ответа №5: самостоятельные действия артиста (сменил пароль,
 * аватарку) из дефолта НЕ убираются. В журнале это `user_data_updated`,
 * записанный на самого артиста; «привязан/отвязан админом» — тот же тип, но с
 * ролью admin, и в «Главное» не попадает.
 *
 * Ограничение, зафиксированное в документе: отдельного типа «сломался синк» в
 * журнале нет — кроновые ошибки либо не логируются, либо неотличимы. «Ошибки»
 * показывают `parser_error`, то есть всё, что журналируется сегодня; полный
 * охват третьего желания владельца — фича-трек логики событий.
 */
import type { ActivityType } from './storage'

export type ActivityView = 'main' | 'playlists' | 'signatures' | 'errors' | 'all'

export const ACTIVITY_VIEWS: readonly ActivityView[] = [
  'main',
  'playlists',
  'signatures',
  'errors',
  'all',
] as const

/** Добавления в плейлисты — желание владельца №1. */
const PLAYLIST_TYPES: ActivityType[] = ['playlist_found', 'parser_playlist_found']

/** Подписание и ознакомление с отчётом — желание владельца №2. */
const SIGNATURE_TYPES: ActivityType[] = ['report_status_changed']

/** Поломки — желание владельца №3, в границах того, что пишется в журнал. */
const ERROR_TYPES: ActivityType[] = ['parser_error']

export interface ActivityViewFilter {
  /** Типы событий вида. Пустой массив — по типу не ограничиваем. */
  types: ActivityType[]
  /**
   * Добавить самостоятельные действия артиста (`user_data_updated` с ролью
   * artist) поверх типов вида — ответ №5.
   */
  includeArtistSelfProfile: boolean
}

export function isActivityView(value: unknown): value is ActivityView {
  return typeof value === 'string' && (ACTIVITY_VIEWS as readonly string[]).includes(value)
}

export function activityViewFilter(view: ActivityView): ActivityViewFilter {
  switch (view) {
    case 'main':
      return {
        types: [...PLAYLIST_TYPES, ...SIGNATURE_TYPES, ...ERROR_TYPES],
        includeArtistSelfProfile: true,
      }
    case 'playlists':
      return { types: [...PLAYLIST_TYPES], includeArtistSelfProfile: false }
    case 'signatures':
      return { types: [...SIGNATURE_TYPES], includeArtistSelfProfile: false }
    case 'errors':
      return { types: [...ERROR_TYPES], includeArtistSelfProfile: false }
    case 'all':
    default:
      return { types: [], includeArtistSelfProfile: false }
  }
}
