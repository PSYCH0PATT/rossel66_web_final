import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  activityActorLabel,
  artistActivityMatches,
  dedupeActivities,
  type ActivityLike,
} from "./activity-log"

const at = "2026-08-15T12:53:04.000Z"

function activity(patch: Partial<ActivityLike>): ActivityLike {
  return {
    id: Math.random().toString(36).slice(2),
    type: "release_added",
    userId: "1782822801744",
    userRole: "artist",
    title: "Добавлен релиз",
    description: 'Добавлен релиз "PHANTOM SIGNAL"',
    metadata: { releaseId: "rel-1", artistId: "1782822801744" },
    createdAt: at,
    ...patch,
  }
}

/**
 * F-03 — каждое добавление релиза задвоено одним таймстампом: строка
 * «КТО = Система» и строка «КТО = 1782822801744» (docs/ui-visual-findings.md:58).
 * Пишутся они парой (уведомление артисту + уведомление админу), а в общем
 * журнале админа видны обе — и вторая ещё и без имени.
 */
describe("dedupeActivities", () => {
  it("схлопывает пару «артисту + админу» об одном релизе", () => {
    const rows = [
      activity({ id: "a", userId: "system", userRole: "admin",
        description: 'Добавлен релиз "PHANTOM SIGNAL" (артист: rompy)' }),
      activity({ id: "b" }),
    ]
    const result = dedupeActivities(rows)
    assert.equal(result.length, 1)
    // Остаётся строка с контекстом артиста — она информативнее.
    assert.equal(result[0].id, "a")
  })

  it("схлопывает пары по всему журналу и сохраняет порядок", () => {
    const rows = [
      activity({ id: "s1", userId: "system", userRole: "admin", metadata: { releaseId: "r1" },
        description: 'Добавлен релиз "PHANTOM SIGNAL" (артист: rompy)' }),
      activity({ id: "a1", metadata: { releaseId: "r1" } }),
      activity({ id: "s2", userId: "system", userRole: "admin", metadata: { releaseId: "r2" },
        description: 'Добавлен релиз "STARLIGHT" (артист: rompy)' }),
      activity({ id: "a2", metadata: { releaseId: "r2" } }),
    ]
    assert.deepEqual(dedupeActivities(rows).map((r) => r.id), ["s1", "s2"])
  })

  it("разные релизы в одну секунду — разные события", () => {
    const rows = [
      activity({ id: "a", metadata: { releaseId: "r1" }, description: 'Добавлен релиз "MIDNIGHT"' }),
      activity({ id: "b", metadata: { releaseId: "r2" }, description: 'Добавлен релиз "ECHOES"' }),
    ]
    assert.equal(dedupeActivities(rows).length, 2)
  })

  it("один релиз в разные дни — разные события", () => {
    const rows = [
      activity({ id: "a", createdAt: "2026-08-15T12:53:04.000Z" }),
      activity({ id: "b", createdAt: "2026-08-16T12:53:04.000Z" }),
    ]
    assert.equal(dedupeActivities(rows).length, 2)
  })

  it("события разных типов не схлопываются", () => {
    const rows = [
      activity({ id: "a", type: "release_added" }),
      activity({ id: "b", type: "release_status_updated" }),
    ]
    assert.equal(dedupeActivities(rows).length, 2)
  })
})

describe("activityActorLabel", () => {
  it("сырой числовой ID не попадает на экран", () => {
    // В колонке «КТО» стояло «1782822801744»: имя искалось в подгруженной
    // странице списка пользователей, и почти всегда там не находилось.
    const label = activityActorLabel(activity({}), new Map())
    assert.ok(!label.includes("1782822801744"), `на экран ушёл сырой ID: ${label}`)
  })

  it("известный артист подписан именем", () => {
    const names = new Map([["1782822801744", "rompy"]])
    assert.equal(activityActorLabel(activity({}), names), "rompy")
  })

  it("системные события подписаны «Система»", () => {
    assert.equal(activityActorLabel(activity({ userId: "system" }), new Map()), "Система")
  })
})

/**
 * F-04 — лента артиста не отражает его активность: «ПОКАЗАНО СОБЫТИЙ: 1» при
 * 4 релизах и 2 отчётах (docs/ui-visual-findings.md:59). События по релизам и
 * отчётам пишутся системой (`userId: "system"`) с артистом в metadata, а лента
 * фильтровала строго по `userId`, и до артиста они не доходили.
 */
describe("artistActivityMatches", () => {
  const group = ["id-main", "id-linked"]

  it("видит событие, записанное на самого артиста", () => {
    assert.equal(artistActivityMatches(activity({ userId: "id-main" }), group), true)
  })

  it("видит системное событие про этого артиста", () => {
    const row = activity({ userId: "system", userRole: "admin", metadata: { artistId: "id-main" } })
    assert.equal(artistActivityMatches(row, group), true)
  })

  it("видит события привязанного профиля — кабинет у группы один", () => {
    assert.equal(artistActivityMatches(activity({ userId: "id-linked" }), group), true)
    const row = activity({ userId: "system", userRole: "admin", metadata: { artistId: "id-linked" } })
    assert.equal(artistActivityMatches(row, group), true)
  })

  it("чужие события в кабинет не попадают", () => {
    assert.equal(artistActivityMatches(activity({ userId: "id-other" }), group), false)
    const row = activity({ userId: "system", userRole: "admin", metadata: { artistId: "id-other" } })
    assert.equal(artistActivityMatches(row, group), false)
  })
})
