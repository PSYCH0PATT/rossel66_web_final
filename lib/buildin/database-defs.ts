import type { RichTextItem } from "@/lib/buildin/types"
import { richText } from "@/lib/buildin/types"

function titleSchema(name: string) {
  return { name, type: "title" as const, title: {} }
}

function richTextSchema(name: string) {
  return { name, type: "rich_text" as const, rich_text: {} }
}

function numberSchema(name: string) {
  return { name, type: "number" as const, number: { format: "number" } }
}

function checkboxSchema(name: string) {
  return { name, type: "checkbox" as const, checkbox: {} }
}

function urlSchema(name: string) {
  return { name, type: "url" as const, url: {} }
}

function emailSchema(name: string) {
  return { name, type: "email" as const, email: {} }
}

function dateSchema(name: string) {
  return { name, type: "date" as const, date: {} }
}

function selectSchema(
  name: string,
  options: Array<{ name: string; color?: string }>
) {
  return {
    name,
    type: "select" as const,
    select: {
      options: options.map((o) => ({
        name: o.name,
        color: o.color ?? "grey",
      })),
    },
  }
}

function multiSelectSchema(
  name: string,
  options: Array<{ name: string; color?: string }>
) {
  return {
    name,
    type: "multi_select" as const,
    multi_select: {
      options: options.map((o) => ({
        name: o.name,
        color: o.color ?? "grey",
      })),
    },
  }
}

function peopleSchema(name: string) {
  return { name, type: "people" as const, people: {} }
}

function relationSchema(
  name: string,
  databaseIdEnvKey: string,
  dual = false
) {
  return {
    name,
    type: "relation" as const,
    /** Placeholder env key; resolve via resolveRelationDatabaseIds() before create/mutate */
    relation: {
      database_id: databaseIdEnvKey,
      type: dual ? ("dual_property" as const) : ("single_property" as const),
    },
  }
}

/** Drop relation props (need real UUIDs) — used by setup scripts on first create. */
export function propertiesWithoutRelations(
  properties: Record<string, { type: string }>
) {
  return Object.fromEntries(
    Object.entries(properties).filter(([, p]) => p.type !== "relation")
  )
}

/**
 * Replace BUILDIN_DB_* placeholders in relation schemas with live UUIDs from env.
 * Returns null for a property if the target env is missing.
 */
export function resolveRelationDatabaseIds(
  properties: Record<string, unknown>,
  resolveEnv: (key: string) => string | null | undefined
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [name, raw] of Object.entries(properties)) {
    const p = raw as {
      type?: string
      relation?: { database_id?: string; type?: string }
      name?: string
    }
    if (p.type !== "relation" || !p.relation?.database_id) {
      out[name] = raw
      continue
    }
    const envKey = p.relation.database_id
    const uuid =
      /^[0-9a-f-]{36}$/i.test(envKey) ? envKey : resolveEnv(envKey)
    if (!uuid) continue
    out[name] = {
      ...p,
      relation: {
        ...p.relation,
        database_id: uuid,
      },
    }
  }
  return out
}

function pageTitle(content: string): RichTextItem[] {
  return richText(content)
}

const FORM_QUEUE_STATUS = selectSchema("Статус", [
  { name: "Загружается", color: "grey" },
  { name: "Новая", color: "blue" },
  { name: "В работе", color: "yellow" },
  { name: "Ждём артиста", color: "orange" },
  { name: "Одобрена", color: "green" },
  { name: "Отклонена", color: "red" },
  { name: "Готово", color: "purple" },
])

const FORM_QUEUE_PRIORITY = selectSchema("Приоритет", [
  { name: "Низкий", color: "grey" },
  { name: "Обычный", color: "blue" },
  { name: "Высокий", color: "orange" },
  { name: "Срочный", color: "red" },
])

const FORM_QUEUE_SOURCE = selectSchema("Источник", [
  { name: "Сайт", color: "green" },
  { name: "Двойная запись", color: "blue" },
  { name: "Вручную", color: "grey" },
])

/** List columns for catalog / release upload / distribution — only these four */
function formQueueApplicationProperties() {
  return {
    Артист: titleSchema("Артист"),
    "Название релиза": richTextSchema("Название релиза"),
    "Дата заявки": dateSchema("Дата заявки"),
    Обработана: checkboxSchema("Обработана"),
  }
}

export const BUILDIN_DATABASE_DEFS = {
  /** Contact + RF / not-RF questionnaires only (not catalog/release/distribution) */
  submissions: {
    title: pageTitle("ROSSEL — Анкеты и обращения"),
    icon: { type: "emoji" as const, emoji: "📥" },
    properties: {
      Название: titleSchema("Название"),
      Тип: selectSchema("Тип", [
        { name: "Анкета РФ", color: "orange" },
        { name: "Анкета не РФ", color: "yellow" },
        { name: "Обращение", color: "pink" },
      ]),
      Статус: FORM_QUEUE_STATUS,
      Email: emailSchema("Email"),
      Telegram: richTextSchema("Telegram"),
      Артист: richTextSchema("Артист"),
      "Кол-во файлов": numberSchema("Кол-во файлов"),
      Приоритет: FORM_QUEUE_PRIORITY,
      Дедлайн: dateSchema("Дедлайн"),
      Ответственный: peopleSchema("Ответственный"),
      "Ссылка админа": urlSchema("Ссылка админа"),
      Источник: FORM_QUEUE_SOURCE,
      АртистRel: relationSchema("АртистRel", "BUILDIN_DB_ARTISTS"),
      РелизRel: relationSchema("РелизRel", "BUILDIN_DB_RELEASES"),
      /** Diagnostics last */
      "Pyrus Task ID": richTextSchema("Pyrus Task ID"),
      "Payload JSON": richTextSchema("Payload JSON"),
      "Artist Local ID": richTextSchema("Artist Local ID"),
      "Release Local ID": richTextSchema("Release Local ID"),
      "Технический ID": richTextSchema("Технический ID"),
    },
  },
  /** Multi-release catalog — details live on the page body */
  form_back_catalog: {
    title: pageTitle("ROSSEL — Бэк-каталог"),
    icon: { type: "emoji" as const, emoji: "📚" },
    properties: formQueueApplicationProperties(),
  },
  /** Single release upload — details live on the page body */
  form_release_upload: {
    title: pageTitle("ROSSEL — Загрузка релиза"),
    icon: { type: "emoji" as const, emoji: "⬆️" },
    properties: formQueueApplicationProperties(),
  },
  /** Distribution — details (incl. contact) live on the page body */
  form_distribution: {
    title: pageTitle("ROSSEL — Дистрибуция"),
    icon: { type: "emoji" as const, emoji: "🌐" },
    properties: formQueueApplicationProperties(),
  },
  artists: {
    title: pageTitle("ROSSEL — Артисты (CRM)"),
    icon: { type: "emoji" as const, emoji: "🎤" },
    properties: {
      Имя: titleSchema("Имя"),
      Юзернейм: richTextSchema("Юзернейм"),
      Email: emailSchema("Email"),
      Верифицирован: checkboxSchema("Верифицирован"),
      "Операционный статус": selectSchema("Операционный статус", [
        { name: "Активен", color: "green" },
        { name: "Онбординг", color: "yellow" },
        { name: "Пауза", color: "orange" },
        { name: "Архив", color: "grey" },
      ]),
      Ответственный: peopleSchema("Ответственный"),
      Теги: multiSelectSchema("Теги", [
        { name: "priority", color: "red" },
        { name: "new", color: "green" },
        { name: "needs_contract", color: "orange" },
      ]),
      Заметки: richTextSchema("Заметки"),
      Дедлайн: dateSchema("Дедлайн"),
      "VK Music": urlSchema("VK Music"),
      "Yandex Music": urlSchema("Yandex Music"),
      Spotify: urlSchema("Spotify"),
      /** Diagnostics last — hide in working views */
      "Локальный ID": richTextSchema("Локальный ID"),
      "Версия синхр.": numberSchema("Версия синхр."),
    },
  },
  releases: {
    title: pageTitle("ROSSEL — Релизы"),
    icon: { type: "emoji" as const, emoji: "💿" },
    properties: {
      Название: titleSchema("Название"),
      "Имя артиста": richTextSchema("Имя артиста"),
      UPC: richTextSchema("UPC"),
      "Дата релиза": dateSchema("Дата релиза"),
      Тип: richTextSchema("Тип"),
      "Авто-статус": richTextSchema("Авто-статус"),
      "Операционный статус": selectSchema("Операционный статус", [
        { name: "Приёмка", color: "grey" },
        { name: "Подготовка", color: "yellow" },
        { name: "Готов", color: "blue" },
        { name: "Доставлен", color: "green" },
        { name: "Блок", color: "red" },
      ]),
      Ответственный: peopleSchema("Ответственный"),
      Дедлайн: dateSchema("Дедлайн"),
      Заметки: richTextSchema("Заметки"),
      Cover: urlSchema("Cover"),
      Bandlink: urlSchema("Bandlink"),
      АртистRel: relationSchema("АртистRel", "BUILDIN_DB_ARTISTS"),
      "Локальный ID": richTextSchema("Локальный ID"),
      "ID артиста": richTextSchema("ID артиста"),
      "Версия синхр.": numberSchema("Версия синхр."),
    },
  },
  tracks: {
    title: pageTitle("ROSSEL — Треки"),
    icon: { type: "emoji" as const, emoji: "🎵" },
    properties: {
      Название: titleSchema("Название"),
      ISRC: richTextSchema("ISRC"),
      Артисты: richTextSchema("Артисты"),
      Язык: richTextSchema("Язык"),
      Мат: checkboxSchema("Мат"),
      Фокус: checkboxSchema("Фокус"),
      Длительность: richTextSchema("Длительность"),
      РелизRel: relationSchema("РелизRel", "BUILDIN_DB_RELEASES"),
      "Локальный ID": richTextSchema("Локальный ID"),
      "Локальный ID релиза": richTextSchema("Локальный ID релиза"),
      "ID заявки": richTextSchema("ID заявки"),
    },
  },
  reports: {
    title: pageTitle("ROSSEL — Отчёты и выплаты"),
    icon: { type: "emoji" as const, emoji: "📑" },
    properties: {
      Название: titleSchema("Название"),
      Артист: richTextSchema("Артист"),
      Квартал: richTextSchema("Квартал"),
      Год: numberSchema("Год"),
      Сумма: numberSchema("Сумма"),
      Прослушивания: numberSchema("Прослушивания"),
      Оплачен: checkboxSchema("Оплачен"),
      Подписан: checkboxSchema("Подписан"),
      Подтверждён: checkboxSchema("Подтверждён"),
      Зарегистрирован: checkboxSchema("Зарегистрирован"),
      "Операционный статус": selectSchema("Операционный статус", [
        { name: "Очередь", color: "grey" },
        { name: "Проверка", color: "yellow" },
        { name: "К выплате", color: "orange" },
        { name: "Выплачен", color: "green" },
        { name: "Блок", color: "red" },
      ]),
      Ответственный: peopleSchema("Ответственный"),
      Дедлайн: dateSchema("Дедлайн"),
      Заметки: richTextSchema("Заметки"),
      "URL файла": urlSchema("URL файла"),
      АртистRel: relationSchema("АртистRel", "BUILDIN_DB_ARTISTS"),
      "Локальный ID": richTextSchema("Локальный ID"),
      "ID артиста": richTextSchema("ID артиста"),
      "Версия синхр.": numberSchema("Версия синхр."),
    },
  },
  playlists: {
    title: pageTitle("ROSSEL — Плейлистные размещения"),
    icon: { type: "emoji" as const, emoji: "📻" },
    properties: {
      /** Title column = track name (one row per track placement). */
      Трек: titleSchema("Трек"),
      Артист: richTextSchema("Артист"),
      Плейлист: richTextSchema("Плейлист"),
      URL: urlSchema("URL"),
      /** First system observation (MSK day), not DSP add date. */
      "Впервые обнаружен": dateSchema("Впервые обнаружен"),
    },
  },
  automation_runs: {
    title: pageTitle("ROSSEL — Запуски автоматизаций"),
    icon: { type: "emoji" as const, emoji: "⚙️" },
    properties: {
      Platform: titleSchema("Platform"),
      Status: selectSchema("Status", [
        { name: "idle", color: "grey" },
        { name: "running", color: "blue" },
        { name: "ok", color: "green" },
        { name: "error", color: "red" },
      ]),
      "Last Run": dateSchema("Last Run"),
      "Needs Cookies": checkboxSchema("Needs Cookies"),
      "Failed Attempts": numberSchema("Failed Attempts"),
      "Last Error": richTextSchema("Last Error"),
      "Admin Link": urlSchema("Admin Link"),
    },
  },
  pii_rf: {
    title: pageTitle("ROSSEL — PII РФ (закрытая)"),
    icon: { type: "emoji" as const, emoji: "🔒" },
    properties: {
      Nickname: titleSchema("Nickname"),
      Email: emailSchema("Email"),
      Telegram: richTextSchema("Telegram"),
      "Full Name": richTextSchema("Full Name"),
      "Short Name": richTextSchema("Short Name"),
      DOB: richTextSchema("DOB"),
      Passport: richTextSchema("Passport"),
      IssuedBy: richTextSchema("IssuedBy"),
      IssueDate: richTextSchema("IssueDate"),
      DeptCode: richTextSchema("DeptCode"),
      "Place of Birth": richTextSchema("Place of Birth"),
      Address: richTextSchema("Address"),
      SNILS: richTextSchema("SNILS"),
      INN: richTextSchema("INN"),
      Bank: richTextSchema("Bank"),
      Account: richTextSchema("Account"),
      CorrAccount: richTextSchema("CorrAccount"),
      BIK: richTextSchema("BIK"),
      BankINN: richTextSchema("BankINN"),
      KPP: richTextSchema("KPP"),
      ЗаявкаRel: relationSchema("ЗаявкаRel", "BUILDIN_DB_SUBMISSIONS"),
      "Submission ID": richTextSchema("Submission ID"),
    },
  },
  pii_not_rf: {
    title: pageTitle("ROSSEL — PII не РФ (закрытая)"),
    icon: { type: "emoji" as const, emoji: "🔐" },
    properties: {
      Nickname: titleSchema("Nickname"),
      Email: emailSchema("Email"),
      Telegram: richTextSchema("Telegram"),
      Citizenship: richTextSchema("Citizenship"),
      "Full Name": richTextSchema("Full Name"),
      "Short Name": richTextSchema("Short Name"),
      DOB: richTextSchema("DOB"),
      "Passport ID": richTextSchema("Passport ID"),
      TaxID: richTextSchema("TaxID"),
      Address: richTextSchema("Address"),
      Bank: richTextSchema("Bank"),
      Account: richTextSchema("Account"),
      ЗаявкаRel: relationSchema("ЗаявкаRel", "BUILDIN_DB_SUBMISSIONS"),
      "Submission ID": richTextSchema("Submission ID"),
    },
  },
  /** Archived — no longer written by form sessions */
  submission_releases: {
    title: pageTitle("ROSSEL — Релизы заявок (архив)"),
    icon: { type: "emoji" as const, emoji: "💿" },
    properties: {
      Название: titleSchema("Название"),
      "Session ID": richTextSchema("Session ID"),
      "Release Index": numberSchema("Release Index"),
      "Тип релиза": selectSchema("Тип релиза", [
        { name: "1", color: "blue" },
        { name: "2", color: "purple" },
        { name: "3", color: "green" },
        { name: "4", color: "orange" },
      ]),
      Артисты: richTextSchema("Артисты"),
      UPC: richTextSchema("UPC"),
      Жанр: richTextSchema("Жанр"),
      "Дата релиза": dateSchema("Дата релиза"),
      "Кол-во треков": numberSchema("Кол-во треков"),
      ЗаявкаRel: relationSchema("ЗаявкаRel", "BUILDIN_DB_SUBMISSIONS"),
    },
  },
  submission_tracks: {
    title: pageTitle("ROSSEL — Треки заявок (архив)"),
    icon: { type: "emoji" as const, emoji: "🎵" },
    properties: {
      Название: titleSchema("Название"),
      "Session ID": richTextSchema("Session ID"),
      "Release Index": numberSchema("Release Index"),
      "Track Index": numberSchema("Track Index"),
      Артисты: richTextSchema("Артисты"),
      ISRC: richTextSchema("ISRC"),
      Язык: richTextSchema("Язык"),
      Explicit: checkboxSchema("Explicit"),
      Focus: checkboxSchema("Focus"),
      "Preview Start": richTextSchema("Preview Start"),
      "Music Author": richTextSchema("Music Author"),
      "Words Author": richTextSchema("Words Author"),
      РелизЗаявкиRel: relationSchema(
        "РелизЗаявкиRel",
        "BUILDIN_DB_SUBMISSION_RELEASES"
      ),
      ЗаявкаRel: relationSchema("ЗаявкаRel", "BUILDIN_DB_SUBMISSIONS"),
    },
  },
  activity: {
    title: pageTitle("ROSSEL — Активность (архив)"),
    icon: { type: "emoji" as const, emoji: "📋" },
    properties: {
      Title: titleSchema("Title"),
      "Local ID": richTextSchema("Local ID"),
      Type: richTextSchema("Type"),
      Role: richTextSchema("Role"),
      "User ID": richTextSchema("User ID"),
      Description: richTextSchema("Description"),
      Created: dateSchema("Created"),
    },
  },
  playlist_history: {
    title: pageTitle("ROSSEL — История плейлистов (архив)"),
    icon: { type: "emoji" as const, emoji: "🕘" },
    properties: {
      Playlist: titleSchema("Playlist"),
      "Local ID": richTextSchema("Local ID"),
      Platform: richTextSchema("Platform"),
      Change: richTextSchema("Change"),
      Date: richTextSchema("Date"),
      Артист: richTextSchema("Артист"),
      Track: richTextSchema("Track"),
      URL: urlSchema("URL"),
    },
  },
} as const

export type BuildinDatabaseDefKey = keyof typeof BUILDIN_DATABASE_DEFS
