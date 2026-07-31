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

export const BUILDIN_DATABASE_DEFS = {
  submissions: {
    title: pageTitle("ROSSEL — Заявки"),
    icon: { type: "emoji" as const, emoji: "📥" },
    properties: {
      Название: titleSchema("Название"),
      Тип: selectSchema("Тип", [
        { name: "release_upload", color: "blue" },
        { name: "catalog_upload", color: "purple" },
        { name: "distribution", color: "green" },
        { name: "data_rf", color: "orange" },
        { name: "data_not_rf", color: "yellow" },
        { name: "contact", color: "pink" },
      ]),
      Статус: selectSchema("Статус", [
        { name: "Загружается", color: "grey" },
        { name: "Новая", color: "blue" },
        { name: "В работе", color: "yellow" },
        { name: "Ждём артиста", color: "orange" },
        { name: "Одобрена", color: "green" },
        { name: "Отклонена", color: "red" },
        { name: "Готово", color: "purple" },
      ]),
      "Кол-во релизов": numberSchema("Кол-во релизов"),
      "Кол-во треков": numberSchema("Кол-во треков"),
      "Session ID": richTextSchema("Session ID"),
      "ID заявки": richTextSchema("ID заявки"),
      Email: emailSchema("Email"),
      Telegram: richTextSchema("Telegram"),
      Артист: richTextSchema("Артист"),
      "Pyrus Task ID": richTextSchema("Pyrus Task ID"),
      "Payload JSON": richTextSchema("Payload JSON"),
      "Кол-во файлов": numberSchema("Кол-во файлов"),
      Приоритет: selectSchema("Приоритет", [
        { name: "Низкий", color: "grey" },
        { name: "Обычный", color: "blue" },
        { name: "Высокий", color: "orange" },
        { name: "Срочный", color: "red" },
      ]),
      Дедлайн: dateSchema("Дедлайн"),
      Ответственный: peopleSchema("Ответственный"),
      "Admin Link": urlSchema("Admin Link"),
      Источник: selectSchema("Источник", [
        { name: "site", color: "green" },
        { name: "dual_write", color: "blue" },
        { name: "manual", color: "grey" },
      ]),
      /** Text Local ID kept for diagnostics/rollback; relations are canonical links */
      "Artist Local ID": richTextSchema("Artist Local ID"),
      "Release Local ID": richTextSchema("Release Local ID"),
      АртистRel: relationSchema("АртистRel", "BUILDIN_DB_ARTISTS"),
      РелизRel: relationSchema("РелизRel", "BUILDIN_DB_RELEASES"),
    },
  },
  artists: {
    title: pageTitle("ROSSEL — Артисты (CRM)"),
    icon: { type: "emoji" as const, emoji: "🎤" },
    properties: {
      Имя: titleSchema("Имя"),
      Username: richTextSchema("Username"),
      "Local ID": richTextSchema("Local ID"),
      Email: emailSchema("Email"),
      Verified: checkboxSchema("Verified"),
      "Ops Status": selectSchema("Ops Status", [
        { name: "Активен", color: "green" },
        { name: "Онбординг", color: "yellow" },
        { name: "Пауза", color: "orange" },
        { name: "Архив", color: "grey" },
      ]),
      Assignee: peopleSchema("Assignee"),
      Tags: multiSelectSchema("Tags", [
        { name: "priority", color: "red" },
        { name: "new", color: "green" },
        { name: "needs_contract", color: "orange" },
      ]),
      Notes: richTextSchema("Notes"),
      Deadline: dateSchema("Deadline"),
      "VK Music": urlSchema("VK Music"),
      "Yandex Music": urlSchema("Yandex Music"),
      Spotify: urlSchema("Spotify"),
      "Sync Version": numberSchema("Sync Version"),
    },
  },
  releases: {
    title: pageTitle("ROSSEL — Релизы (ops)"),
    icon: { type: "emoji" as const, emoji: "💿" },
    properties: {
      Название: titleSchema("Название"),
      "Local ID": richTextSchema("Local ID"),
      "Artist ID": richTextSchema("Artist ID"),
      "Artist Name": richTextSchema("Artist Name"),
      UPC: richTextSchema("UPC"),
      "Release Date": dateSchema("Release Date"),
      Type: richTextSchema("Type"),
      "Auto Status": richTextSchema("Auto Status"),
      "Ops Status": selectSchema("Ops Status", [
        { name: "Приёмка", color: "grey" },
        { name: "Подготовка", color: "yellow" },
        { name: "Готов", color: "blue" },
        { name: "Доставлен", color: "green" },
        { name: "Блок", color: "red" },
      ]),
      Assignee: peopleSchema("Assignee"),
      Deadline: dateSchema("Deadline"),
      Notes: richTextSchema("Notes"),
      Cover: urlSchema("Cover"),
      Bandlink: urlSchema("Bandlink"),
      "Sync Version": numberSchema("Sync Version"),
      АртистRel: relationSchema("АртистRel", "BUILDIN_DB_ARTISTS"),
    },
  },
  tracks: {
    title: pageTitle("ROSSEL — Треки"),
    icon: { type: "emoji" as const, emoji: "🎵" },
    properties: {
      Название: titleSchema("Название"),
      "Local ID": richTextSchema("Local ID"),
      "Release Local ID": richTextSchema("Release Local ID"),
      "Submission ID": richTextSchema("Submission ID"),
      ISRC: richTextSchema("ISRC"),
      Artists: richTextSchema("Artists"),
      Language: richTextSchema("Language"),
      Explicit: checkboxSchema("Explicit"),
      Focus: checkboxSchema("Focus"),
      Duration: richTextSchema("Duration"),
      РелизRel: relationSchema("РелизRel", "BUILDIN_DB_RELEASES"),
    },
  },
  reports: {
    title: pageTitle("ROSSEL — Отчёты и выплаты"),
    icon: { type: "emoji" as const, emoji: "📑" },
    properties: {
      Название: titleSchema("Название"),
      "Local ID": richTextSchema("Local ID"),
      "Artist ID": richTextSchema("Artist ID"),
      Артист: richTextSchema("Артист"),
      Quarter: richTextSchema("Quarter"),
      Year: numberSchema("Year"),
      Amount: numberSchema("Amount"),
      Plays: numberSchema("Plays"),
      Paid: checkboxSchema("Paid"),
      Signed: checkboxSchema("Signed"),
      Acknowledged: checkboxSchema("Acknowledged"),
      Registered: checkboxSchema("Registered"),
      "Ops Status": selectSchema("Ops Status", [
        { name: "Очередь", color: "grey" },
        { name: "Проверка", color: "yellow" },
        { name: "К выплате", color: "orange" },
        { name: "Выплачен", color: "green" },
        { name: "Блок", color: "red" },
      ]),
      Assignee: peopleSchema("Assignee"),
      Deadline: dateSchema("Deadline"),
      Notes: richTextSchema("Notes"),
      "File URL": urlSchema("File URL"),
      "Sync Version": numberSchema("Sync Version"),
      АртистRel: relationSchema("АртистRel", "BUILDIN_DB_ARTISTS"),
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
      "Submission ID": richTextSchema("Submission ID"),
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
      /** Payload JSON removed — structured fields only */
      ЗаявкаRel: relationSchema("ЗаявкаRel", "BUILDIN_DB_SUBMISSIONS"),
    },
  },
  pii_not_rf: {
    title: pageTitle("ROSSEL — PII не РФ (закрытая)"),
    icon: { type: "emoji" as const, emoji: "🔐" },
    properties: {
      Nickname: titleSchema("Nickname"),
      "Submission ID": richTextSchema("Submission ID"),
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
    },
  },
  submission_releases: {
    title: pageTitle("ROSSEL — Релизы заявок"),
    icon: { type: "emoji" as const, emoji: "💿" },
    properties: {
      Название: titleSchema("Название"),
      "Session ID": richTextSchema("Session ID"),
      "Release Index": numberSchema("Release Index"),
      "Тип релиза": selectSchema("Тип релиза", [
        { name: "1", color: "blue" },
        { name: "2", color: "purple" },
        { name: "3", color: "green" },
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
    title: pageTitle("ROSSEL — Треки заявок"),
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
