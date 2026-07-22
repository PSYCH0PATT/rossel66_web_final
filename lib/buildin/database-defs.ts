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
      ]),
      Статус: selectSchema("Статус", [
        { name: "new", color: "grey" },
        { name: "in_review", color: "yellow" },
        { name: "needs_info", color: "orange" },
        { name: "approved", color: "green" },
        { name: "rejected", color: "red" },
        { name: "done", color: "blue" },
      ]),
      "ID заявки": richTextSchema("ID заявки"),
      Email: emailSchema("Email"),
      Telegram: richTextSchema("Telegram"),
      Артист: richTextSchema("Артист"),
      "Pyrus Task ID": richTextSchema("Pyrus Task ID"),
      "Payload JSON": richTextSchema("Payload JSON"),
      "Кол-во файлов": numberSchema("Кол-во файлов"),
      Источник: selectSchema("Источник", [
        { name: "site", color: "green" },
        { name: "dual_write", color: "blue" },
        { name: "manual", color: "grey" },
      ]),
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
        { name: "active", color: "green" },
        { name: "onboarding", color: "yellow" },
        { name: "paused", color: "orange" },
        { name: "archived", color: "grey" },
      ]),
      Assignee: richTextSchema("Assignee"),
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
        { name: "intake", color: "grey" },
        { name: "prep", color: "yellow" },
        { name: "ready", color: "blue" },
        { name: "delivered", color: "green" },
        { name: "blocked", color: "red" },
      ]),
      Assignee: richTextSchema("Assignee"),
      Deadline: dateSchema("Deadline"),
      Notes: richTextSchema("Notes"),
      Cover: urlSchema("Cover"),
      Bandlink: urlSchema("Bandlink"),
      "Sync Version": numberSchema("Sync Version"),
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
        { name: "queue", color: "grey" },
        { name: "review", color: "yellow" },
        { name: "ready_to_pay", color: "orange" },
        { name: "paid", color: "green" },
        { name: "blocked", color: "red" },
      ]),
      Assignee: richTextSchema("Assignee"),
      Deadline: dateSchema("Deadline"),
      Notes: richTextSchema("Notes"),
      "File URL": urlSchema("File URL"),
      "Sync Version": numberSchema("Sync Version"),
    },
  },
  playlists: {
    title: pageTitle("ROSSEL — Плейлистные размещения"),
    icon: { type: "emoji" as const, emoji: "📻" },
    properties: {
      Название: titleSchema("Название"),
      "Local ID": richTextSchema("Local ID"),
      Platform: richTextSchema("Platform"),
      "Artist ID": richTextSchema("Artist ID"),
      Артист: richTextSchema("Артист"),
      URL: urlSchema("URL"),
      "First Seen": richTextSchema("First Seen"),
      "Last Seen": richTextSchema("Last Seen"),
      Cover: urlSchema("Cover"),
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
      "Payload JSON": richTextSchema("Payload JSON"),
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
      "Payload JSON": richTextSchema("Payload JSON"),
    },
  },
  activity: {
    title: pageTitle("ROSSEL — Активность"),
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
    title: pageTitle("ROSSEL — История плейлистов"),
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
