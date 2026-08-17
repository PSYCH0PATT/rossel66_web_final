import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readFileSync } from "node:fs"

/**
 * vercel.json проверяется схемой на стороне Vercel, и любой лишний ключ роняет
 * ДЕПЛОЙ, а не сборку: коммит уезжает в репозиторий, CI зелёный, а на стейдж
 * ничего не попадает. Так уже случилось — комментарий "//" в конфиге тихо
 * заблокировал два деплоя подряд.
 */
const ALLOWED_TOP_LEVEL = new Set([
  "$schema", "git", "crons", "buildCommand", "devCommand", "installCommand",
  "outputDirectory", "framework", "regions", "redirects", "rewrites", "headers",
  "cleanUrls", "trailingSlash", "functions", "images", "public", "ignoreCommand",
])

const config = JSON.parse(readFileSync("vercel.json", "utf-8")) as Record<string, unknown>

describe("vercel.json", () => {
  it("не содержит ключей вне схемы Vercel", () => {
    const unknown = Object.keys(config).filter((key) => !ALLOWED_TOP_LEVEL.has(key))
    assert.deepEqual(
      unknown,
      [],
      `Vercel отвергнет конфиг с этими ключами, и деплой молча не состоится: ${unknown.join(", ")}`
    )
  })

  it("расписание крона задано корректно", () => {
    const crons = (config.crons ?? []) as Array<{ path: string; schedule: string }>
    assert.ok(crons.length > 0, "крон должен быть задан")
    for (const cron of crons) {
      assert.match(cron.path, /^\/api\//, `путь ${cron.path} должен начинаться с /api/`)
      assert.match(
        cron.schedule,
        /^(\S+\s+){4}\S+$/,
        `расписание ${cron.schedule} должно состоять из пяти полей`
      )
    }
  })

  it("не пересекается по часам с боевым расписанием из crontab", () => {
    // Контейнер на Timeweb работает в UTC (TZ нигде не задан), Vercel Cron тоже
    // считает в UTC — без сдвига оба контура дёргали бы SFTP в одну минуту.
    const prodHours = new Set(
      readFileSync("crontab", "utf-8")
        .split("\n")
        .filter((line) => line.trim() && !line.trim().startsWith("#"))
        .map((line) => Number(line.trim().split(/\s+/)[1]))
        .filter((hour) => Number.isFinite(hour))
    )
    const crons = (config.crons ?? []) as Array<{ path: string; schedule: string }>
    for (const cron of crons) {
      const hour = Number(cron.schedule.split(/\s+/)[1])
      assert.ok(
        !prodHours.has(hour),
        `${cron.path} стоит в ${hour}:00 — этот час занят боевым расписанием`
      )
    }
  })
})
