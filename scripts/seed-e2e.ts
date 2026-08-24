/**
 * Сид одноразовой тестовой базы (docker-compose.test.yml).
 *
 * Числа здесь — контракт: тесты сверяются именно с ними, поэтому менять данные
 * без правки тестов нельзя. Что и зачем заводится, описано у каждого блока.
 *
 * Usage: pnpm seed:e2e
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { loadTestEnvFiles, requireTestDatabaseUrl } from "../tests/support/env"
// Чистая функция без импортов — тянуть её сюда безопасно даже до loadTestEnvFiles.
import { mskDateString } from "../lib/msk-date"

loadTestEnvFiles()
const url = requireTestDatabaseUrl()

// requireTestDatabaseUrl уже отбивает облачные хосты, но сид пишет данные, а не
// только читает — поэтому ещё одна, более узкая проверка: только локалхост.
const host = new URL(url).hostname
if (!["127.0.0.1", "localhost", "::1", "postgres"].includes(host)) {
  console.error(`Сид отказывается работать с ${host}: разрешён только локальный Postgres.`)
  process.exit(1)
}

// Prisma 7 берёт соединение через адаптер, а не через `datasources` в конструкторе.
const pool = new Pool({ connectionString: url })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

/** Пароль у всех тестовых пользователей один — база одноразовая, секрета нет. */
const PASSWORD = "e2e-password"

/** Маркер: e2e-тесты падают, если его нет — значит база не сидирована. */
export const SEED_GUARD_USERNAME = "e2e-guard"

const artist = (id: string, username: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  username,
  name,
  email: `${username}@example.test`,
  role: "artist",
  password: PASSWORD,
  verified: true,
  // Реквизиты нужны, чтобы питон-парсер не отбраковал артиста как неполного.
  fio: `Тестовый ${name}`,
  fioShort: name,
  contract: `Д-${username}`,
  percentage: 100,
  ...extra,
})

const report = (
  id: string,
  artistId: string | null,
  artistName: string,
  quarter: string,
  year: number,
  totalAmount: number,
  uploadedAt: string,
  extra: Record<string, unknown> = {}
) => ({
  id,
  artistId,
  artistName,
  quarter,
  year,
  totalAmount,
  totalPlays: Math.round(totalAmount * 10),
  fileName: `${id}.xlsx`,
  filePath: `${quarter}/${id}.xlsx`,
  uploadedAt: new Date(uploadedAt),
  uploadDate: uploadedAt,
  processed: true,
  status: "processed",
  isRegistered: true,
  isSigned: false,
  isPaid: false,
  isAcknowledged: false,
  ...extra,
})

const analytics = (
  id: string,
  trackArtist: string,
  artistId: string | null,
  streams: number,
  isrc: string
) => ({
  id,
  date: new Date("2026-06-15"),
  dsp: "Spotify",
  length: "full",
  source: "e2e",
  isrc,
  trackArtist,
  trackName: `Трек ${isrc}`,
  albumTitle: "E2E Album",
  streams,
  artistId,
})

/**
 * Дата за N дней до сегодняшнего МОСКОВСКОГО дня, в UTC-полночь.
 *
 * Почему скользящая, а не прибитая к календарю (B-12, docs/backlog.md): окно
 * графика — календарное, «последние 30 дней от now()», и таким оно и должно
 * остаться. Считать окно от последней имеющейся строки было бы удобнее для
 * стенда и вредно для боя: при сломанном импорте flash график всё равно
 * выглядел бы полным, и лаг данных (F-18: «обновлено 19 авг», график кончается
 * 13.08) стало бы не видно вовсе. Пустое окно — честный сигнал, что данные не
 * приехали. Поэтому подстраивается сид, а не продукт: даты считаются от дня
 * сидирования, и стенд попадает в окно, когда бы его ни подняли.
 *
 * UTC-полночь именно того же московского дня, потому что границы окна
 * приходят строками «YYYY-MM-DD» и парсятся как UTC-полночь
 * (lib/flash-storage.ts): так строка за сегодня попадает в `lte endDate` при
 * любом часовом поясе машины.
 *
 * Контрактные строки (e2e-sa-*) остаются прибитыми к 2026-06-15: на них
 * завязаны точные агрегаты в тестах с фиксированным окном 2026-06-01…30,
 * скользящие даты сделали бы эти проверки зависимыми от дня прогона.
 */
const daysAgo = (n: number) => {
  const shifted = new Date(Date.now() - n * 24 * 60 * 60 * 1000)
  return new Date(`${mskDateString(shifted)}T00:00:00.000Z`)
}

/**
 * Свежий ряд самого E2E Main: 4 трека × 14 дней × 25 стримов = ровно 1400.
 *
 * Без него кабинет артиста снимался пустым («Нет данных аналитики», «Нет
 * данных») — его контрактные строки прибиты к 2026-06-15 и в окно «последние
 * 30 дней» не попадают. Прибитые строки трогать нельзя: на них завязаны точные
 * агрегаты с фиксированным окном 2026-06-01…30. Поэтому свежесть добавляется
 * отдельным рядом, а контрактные суммы БЕЗ окна выросли ровно на 1400 —
 * см. tests/integration/reports-money.test.ts и tests/e2e/cabinet-linked.spec.ts.
 *
 * Половина треков платные, половина бесплатные: иначе на экране артиста
 * пустует блок «Платные / Бесплатные».
 */
function freshMainArtistAnalytics() {
  const rows = []
  for (let track = 0; track < 4; track++) {
    const n = String(track + 1).padStart(2, "0")
    for (let day = 0; day < 14; day++) {
      rows.push({
        ...analytics(`e2e-sa-main-fresh-${n}-${day}`, "E2E Main", "e2e-main-id", 25, `E2EFRSH00${n}`),
        date: daysAgo(day),
        dsp: CATALOG_DSPS[(track + day) % CATALOG_DSPS.length],
        length: track % 2 === 0 ? CATALOG_LENGTHS[0] : CATALOG_LENGTHS[1],
      })
    }
  }
  return rows
}

const CATALOG_DSPS = ["Spotify", "Яндекс Музыка", "ВК Музыка", "МТС Музыка"] as const
/** Платные/бесплатные — по словарю lib/stream-length.ts. */
const CATALOG_LENGTHS = ["Полный стрим", "6-29 сек"] as const

/** Строки каталога: 16 треков × 14 дней, 4 площадки, платные и бесплатные. */
function catalogAnalytics() {
  const rows = []
  for (let track = 0; track < 16; track++) {
    const n = String(track + 1).padStart(2, "0")
    for (let day = 0; day < 14; day++) {
      for (const [li, length] of CATALOG_LENGTHS.entries()) {
        rows.push({
          ...analytics(
            `e2e-sa-catalog-${n}-${day}-${li}`,
            "E2E Каталог",
            null,
            // Убывающий по треку ряд с дневной волной: видно, что «топ-10»
            // отрезает именно хвост, а график не превращается в прямую.
            Math.max(1, (320 - track * 17) * (li === 0 ? 1 : 0.35) * (1 + ((day % 5) - 2) * 0.15)),
            `E2ECAT00${n}`
          ),
          date: daysAgo(day),
          dsp: CATALOG_DSPS[(track + day) % CATALOG_DSPS.length],
          length,
        })
      }
    }
  }
  return rows.map((r) => ({ ...r, streams: Math.round(r.streams) }))
}

async function main() {
  console.log(`Сидирую ${url.replace(/:[^:@/]+@/, ":***@")}`)

  // Идемпотентность: чистим всё, что сид создаёт, и заводим заново.
  await prisma.advance.deleteMany({})
  await prisma.streamAnalytics.deleteMany({})
  await prisma.report.deleteMany({})
  await prisma.activity.deleteMany({})
  await prisma.user.deleteMany({})

  await prisma.user.createMany({
    data: [
      {
        id: "e2e-admin-id",
        username: "e2e-admin",
        name: "E2E Admin",
        email: "admin@example.test",
        role: "admin",
        password: PASSWORD,
        verified: true,
      },
      artist("e2e-main-id", "e2e-main", "E2E Main"),
      artist("e2e-linked-id", "e2e-linked", "E2E Linked"),
      artist("e2e-solo-id", "e2e-solo", "E2E Solo"),
      artist("e2e-stranger-id", "e2e-stranger", "E2E Stranger"),
      // Артист без реквизитов: питон должен отправить его в skipped_incomplete.
      {
        id: "e2e-incomplete-id",
        username: "e2e-incomplete",
        name: "E2E Incomplete",
        email: "incomplete@example.test",
        role: "artist",
        password: PASSWORD,
        verified: true,
      },
      {
        id: "e2e-guard-id",
        username: SEED_GUARD_USERNAME,
        name: "E2E Guard",
        email: "guard@example.test",
        role: "artist",
        password: PASSWORD,
        verified: false,
      },
    ],
  })

  // Отчёты главного за два квартала: аванс, выданный между ними, должен гаситься
  // только вторым. Начислено 7000, не выплачено 7000.
  await prisma.report.createMany({
    data: [
      report("e2e-report-main-q1", "e2e-main-id", "E2E Main", "Q1", 2026, 2000, "2026-04-10T10:00:00.000Z"),
      report("e2e-report-main-q2", "e2e-main-id", "E2E Main", "Q2", 2026, 5000, "2026-07-10T10:00:00.000Z"),
      // Старый пер-профильный отчёт привязанного — мишень supersede.
      report("e2e-report-linked-q3", "e2e-linked-id", "E2E Linked", "Q3", 2026, 800, "2026-10-05T10:00:00.000Z"),
      // Отчёт солиста: не должен попадать ни в чей чужой кабинет.
      report("e2e-report-solo-q1", "e2e-solo-id", "E2E Solo", "Q1", 2026, 1500, "2026-04-11T10:00:00.000Z"),
    ],
  })

  // Очередь на подпись: 25 строк (> страницы в 20) с разными суммами и датами
  // ознакомления — проверяют пагинацию, сортировку и стабильность страниц.
  const queue = Array.from({ length: 25 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0")
    return report(
      `e2e-report-queue-${n}`,
      null,
      `E2E Queue ${n}`,
      "Q4",
      2026,
      (i + 1) * 100,
      `2026-12-0${(i % 9) + 1}T09:00:00.000Z`,
      {
        isAcknowledged: true,
        acknowledgedAt: new Date(`2026-12-${String((i % 28) + 1).padStart(2, "0")}T12:00:00.000Z`),
        isSigned: null,
      }
    )
  })
  await prisma.report.createMany({ data: queue })

  // Аналитика. Ожидаемые суммы:
  //   свои строки главного        1500
  //   строки привязанного          300
  //   коллаб «Главный & Привязанный» 700 — ОДИН раз, это один человек под двумя
  //                                        именами; двойной счёт здесь и ловим
  //   ---------------------------------
  //   кабинет главного после привязки 2500
  await prisma.streamAnalytics.createMany({
    data: [
      analytics("e2e-sa-main-1", "E2E Main", "e2e-main-id", 1000, "E2EMAIN0001"),
      analytics("e2e-sa-main-2", "E2E Main", "e2e-main-id", 500, "E2EMAIN0002"),
      analytics("e2e-sa-linked-1", "E2E Linked", "e2e-linked-id", 300, "E2ELINK0001"),
      analytics("e2e-sa-collab", "E2E Main & E2E Linked", null, 700, "E2ECOLL0001"),
      analytics("e2e-sa-outsider", "Совсем Чужой Артист", null, 42, "E2EOUTS0001"),
      // B-12 (docs/backlog.md): каталог чужого артиста. Даёт стенду то, чего у
      // него не было: больше десяти треков (работают «топ-10 / Все треки» из
      // вердикта 1.2), несколько площадок и разброс по дням — иначе график
      // собирался из одной точки, а экран аналитики открывался пустым, потому
      // что единственная дата сида (2026-06-15) не попадает в окно «30 дней».
      // Имя намеренно вне групп E2E Main/Linked, artistId пустой: контрактные
      // агрегаты 1500 / 2200 / 2500 считаются по артисту и сюда не заглядывают.
      ...catalogAnalytics(),
      ...freshMainArtistAnalytics(),
    ],
  })

  // Релизы. Контрактные числа для e2e:
  //   у главного 2 своих, у привязанного 3, плюс 1 чужой, где главный приглашённый.
  //   кабинет группы  → 6 (5 своих + 1 с участием)
  //   фильтр «главный» → 3 (2 своих + 1 с участием)
  //   фильтр «привязанный» → 3
  // Релиз с участием обязан не только показываться в списке, но и открываться:
  // артист есть в этом релизе, значит он его.
  const release = (
    id: string,
    artistId: string,
    title: string,
    releaseDate: string,
    featuredArtistIds: string[] = [],
    extra: Partial<{
      status: string
      type: string
      upc: string
      tracks: { id: string; title: string; isrc: string; duration: string }[]
      featuredArtistNames: string[]
    }> = {}
  ) => ({
    id,
    artistId,
    title,
    releaseDate,
    releaseDateSort: new Date(releaseDate),
    status: "Доставлен",
    type: "single",
    featuredArtistIds,
    tracks: [],
    ...extra,
  })

  await prisma.release.deleteMany({})
  await prisma.release.createMany({
    data: [
      /*
       * Карта релиза — экран вердикта 3.4, и снимать её пустой нельзя
       * (правило приёмки docs/ui-audit.md §4): без треков, UPC и фитов
       * проверить нечего — ни сводки «2 трека · ISRC · длительность», ни
       * человекочитаемой строки артистов, ни бейджа «Доставлен» (при нуле
       * треков F-14 подменяет его на «Нет данных»).
       */
      release("e2e-rel-main-1", "e2e-main-id", "E2E Main Track One", "2026-01-10", [], {
        type: "album",
        upc: "0000000000017",
        featuredArtistNames: ["E2E Linked"],
        tracks: [
          { id: "e2e-trk-main-1", title: "E2E Main Track One", isrc: "RU-E2E-26-0001", duration: "3:21" },
          { id: "e2e-trk-main-2", title: "E2E Main Track Two", isrc: "RU-E2E-26-0002", duration: "2:47" },
        ],
      }),
      /* Промежуточный статус: у «В доставке» UPC ещё нет — это состояние, а
       * не дыра в данных (F-93), и точка-иконка против галочки финала (F-92). */
      release("e2e-rel-main-2", "e2e-main-id", "E2E Main Track Two", "2026-02-10", [], {
        status: "В доставке",
      }),
      release("e2e-rel-linked-1", "e2e-linked-id", "E2E Linked Track One", "2026-03-10"),
      release("e2e-rel-linked-2", "e2e-linked-id", "E2E Linked Track Two", "2026-04-10"),
      release("e2e-rel-linked-3", "e2e-linked-id", "E2E Linked Track Three", "2026-05-10"),
      release("e2e-rel-solo-1", "e2e-solo-id", "E2E Solo Track", "2026-01-20"),
      // Релиз чужого артиста, где главный — приглашённый. В списке кабинета он
      // виден, значит и карточка обязана открываться.
      release("e2e-rel-feat", "e2e-stranger-id", "E2E Featuring Track", "2026-06-10", [
        "e2e-main-id",
      ]),
    ],
  })

  // Плейлисты: 2 у главного, 1 у привязанного — кабинет группы должен показать 3,
  // фильтр по профилю сузить до 2 или 1.
  await prisma.playlist.deleteMany({})
  await prisma.playlist.createMany({
    data: [
      {
        id: "e2e-pl-main-1",
        playlistUrl: "https://example.test/pl/main-1",
        playlistName: "E2E Main Playlist One",
        platform: "Spotify",
        artistName: "E2E Main",
        artistId: "e2e-main-id",
      },
      {
        id: "e2e-pl-main-2",
        playlistUrl: "https://example.test/pl/main-2",
        playlistName: "E2E Main Playlist Two",
        platform: "Spotify",
        artistName: "E2E Main",
        artistId: "e2e-main-id",
      },
      {
        id: "e2e-pl-linked-1",
        playlistUrl: "https://example.test/pl/linked-1",
        playlistName: "E2E Linked Playlist",
        platform: "Spotify",
        artistName: "E2E Linked",
        artistId: "e2e-linked-id",
      },
    ],
  })

  // Лента событий: B-12 — сид чистил Activity и ничего не заводил, поэтому
  // и дашборд, и журнал снимались с «Событий пока нет». Типы взяты те же, что
  // показывает вид «Главное» (0-б): плейлисты, подписания, поломки.
  // activity-feed.test.ts чистит таблицу сам, так что этим строкам он не мешает.
  await prisma.activity.createMany({
    data: [
      {
        id: "e2e-act-playlist-1",
        type: "playlist_found",
        userId: "e2e-main-id",
        userRole: "artist",
        title: "Добавлен плейлист",
        description: "«E2E Main Playlist One» · Spotify",
        metadata: { artistId: "e2e-main-id", playlistName: "E2E Main Playlist One" },
        createdAt: daysAgo(0),
      },
      {
        id: "e2e-act-playlist-2",
        type: "parser_playlist_found",
        userId: "system",
        userRole: "admin",
        title: "Добавлен плейлист",
        description: "«E2E Linked Playlist» · Spotify",
        metadata: { artistId: "e2e-linked-id", playlistName: "E2E Linked Playlist" },
        createdAt: daysAgo(1),
      },
      {
        id: "e2e-act-report-1",
        type: "report_status_changed",
        userId: "e2e-main-id",
        userRole: "artist",
        title: "Отчёт подписан",
        description: "Q1 2026 · E2E Main",
        metadata: { artistId: "e2e-main-id", quarter: "Q1 2026" },
        createdAt: daysAgo(2),
      },
      {
        id: "e2e-act-report-2",
        type: "report_status_changed",
        userId: "e2e-linked-id",
        userRole: "artist",
        title: "Артист ознакомился с отчётом",
        description: "Q4 2025 · E2E Linked",
        metadata: { artistId: "e2e-linked-id", quarter: "Q4 2025" },
        createdAt: daysAgo(3),
      },
      {
        id: "e2e-act-error-1",
        type: "parser_error",
        userId: "system",
        userRole: "admin",
        title: "Парсинг не прошёл",
        description: "Zvonko Parser: страница 3 не ответила",
        metadata: { parser: "zvonko" },
        createdAt: daysAgo(4),
      },
    ],
  })

  // История плейлистов: B-12 — без записей экран /playlists/history всегда
  // показывал пустое состояние, и проверить его фильтры было нечем.
  await prisma.playlistHistory.deleteMany({})
  await prisma.playlistHistory.createMany({
    data: [
      {
        id: "e2e-plh-1",
        playlistUrl: "https://example.test/pl/main-1",
        playlistName: "E2E Main Playlist One",
        platform: "Spotify",
        changeType: "added",
        changeDate: "2026-06-15",
        artistName: "E2E Main",
        artistId: "e2e-main-id",
        trackTitle: "E2E Main Track One",
        newPosition: 12,
      },
      {
        id: "e2e-plh-2",
        playlistUrl: "https://example.test/pl/main-1",
        playlistName: "E2E Main Playlist One",
        platform: "Spotify",
        changeType: "position_changed",
        changeDate: "2026-06-16",
        artistName: "E2E Main",
        artistId: "e2e-main-id",
        trackTitle: "E2E Main Track One",
        oldPosition: 12,
        newPosition: 7,
      },
      {
        id: "e2e-plh-3",
        playlistUrl: "https://example.test/pl/main-2",
        playlistName: "E2E Main Playlist Two",
        platform: "Spotify",
        changeType: "added",
        changeDate: "2026-06-17",
        artistName: "E2E Main",
        artistId: "e2e-main-id",
        trackTitle: "E2E Main Track Two",
        newPosition: 3,
      },
      {
        id: "e2e-plh-4",
        playlistUrl: "https://example.test/pl/linked-1",
        playlistName: "E2E Linked Playlist",
        platform: "Spotify",
        changeType: "removed",
        changeDate: "2026-06-18",
        artistName: "E2E Linked",
        artistId: "e2e-linked-id",
        trackTitle: "E2E Linked Track One",
        oldPosition: 21,
      },
    ],
  })

  const counts = {
    пользователей: await prisma.user.count(),
    отчётов: await prisma.report.count(),
    "строк аналитики": await prisma.streamAnalytics.count(),
    релизов: await prisma.release.count(),
    плейлистов: await prisma.playlist.count(),
    "записей истории плейлистов": await prisma.playlistHistory.count(),
    "событий в журнале": await prisma.activity.count(),
  }
  console.log("Готово:", counts)
  await prisma.$disconnect()
  await pool.end()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect().catch(() => {})
  await pool.end().catch(() => {})
  process.exit(1)
})
