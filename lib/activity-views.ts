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
 *
 * Артистская тройка — другая (0-б, артист-ЛК; ответ №8): **статусы релизов ·
 * плейлисты · отчётность**. Вид `artist` собран под неё и админскую тройку не
 * повторяет: у владельца в «Главном» релизов нет, у артиста нет поломок.
 * Б-24: в ленту артиста НЕ входят авансы (`advance_issued`/`advance_removed` —
 * внутренняя бухгалтерия лейбла), выплаты, генерация отчётов, профильные,
 * парсерные и аналитические события. Вид принудительно ставится на сервере
 * (`getCachedActivitiesForFeed`, `/api/activities`), а не выбирается вызовом:
 * событие, которого артист видеть не должен, не доезжает до браузера.
 */
import type { ActivityType } from './storage'

export type ActivityView = 'main' | 'playlists' | 'signatures' | 'errors' | 'all' | 'artist'

export const ACTIVITY_VIEWS: readonly ActivityView[] = [
  'main',
  'playlists',
  'signatures',
  'errors',
  'all',
  'artist',
] as const

/** Добавления в плейлисты — желание владельца №1. */
const PLAYLIST_TYPES: ActivityType[] = ['playlist_found', 'parser_playlist_found']

/** Подписание и ознакомление с отчётом — желание владельца №2. */
const SIGNATURE_TYPES: ActivityType[] = ['report_status_changed']

/** Поломки — желание владельца №3, в границах того, что пишется в журнал. */
const ERROR_TYPES: ActivityType[] = ['parser_error']

/**
 * Статусы релизов — первый пункт артистской тройки. Смена статуса пишется
 * Zvonko-парсером (`release_status_updated`), появление релиза — ручным
 * добавлением, Koala-парсером и привязкой (`release_added`). Два парсерных
 * типа сегодня не пишет никто, но они живые в `ActivityType` и в подписях
 * админского журнала — пусть вид не разъедется с ними при возврате.
 */
const ARTIST_RELEASE_TYPES: ActivityType[] = [
  'release_status_updated',
  'release_added',
  'parser_release_found',
  'parser_release_updated',
]

/**
 * Отчётность артиста — третий пункт тройки: и «вам назначен отчёт»
 * (`report_received`), и подписание/ознакомление (`report_status_changed`).
 * Генерация отчётов (`reports_generated`) — внутренняя операция лейбла.
 */
const ARTIST_REPORT_TYPES: ActivityType[] = ['report_status_changed', 'report_received']

/**
 * Единственный вид ленты кабинета артиста. Ставится на сервере в двух точках
 * входа (lib/cached-dashboard.ts и app/api/activities/route.ts), поэтому имя
 * вида не размазано строковыми литералами по вызовам.
 */
export const ARTIST_FEED_VIEW: ActivityView = 'artist'

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
    case 'artist':
      // Б-24: ровно три группы владельца для артиста. Оговорка №5 сюда не
      // распространяется — «ТОЛЬКО статусы релизов, плейлисты и отчётность».
      return {
        types: [...ARTIST_RELEASE_TYPES, ...PLAYLIST_TYPES, ...ARTIST_REPORT_TYPES],
        includeArtistSelfProfile: false,
      }
    case 'all':
    default:
      return { types: [], includeArtistSelfProfile: false }
  }
}
