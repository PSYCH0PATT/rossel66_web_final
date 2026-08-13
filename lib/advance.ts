/**
 * Авансы артиста и их погашение из роялти.
 *
 * Правило, которое реализует этот модуль:
 *
 * 1. Аванс гасится только теми отчётами, которые **пришли после его выдачи**.
 *    Деньги, заработанные до аванса, артисту принадлежат и в погашение не идут.
 * 2. Несколько авансов гасятся по очереди, от старого к новому (FIFO).
 * 3. Погашение НЕ зависит от флага `isPaid`. Иначе отметка «выплачено» задним
 *    числом меняла бы историю погашения: сумма, ушедшая в аванс, то исчезала бы
 *    из базы погашения, то возвращалась. Здесь база — сам факт начисления.
 * 4. К выплате доступно `начислено − погашено аванса − уже выплачено`. Пока
 *    остаток аванса не добит, доступная сумма естественным образом равна нулю.
 *
 * Функция чистая: никакой базы, только арифметика — поэтому её можно покрыть
 * тестами целиком.
 */

export type AdvanceInput = {
  /** Сумма выданного аванса, ₽. */
  amount: number
  /** Дата выдачи. */
  issuedAt: Date
}

export type RecoupableReport = {
  /** Начисление по отчёту, ₽. */
  amount: number
  /** Дата, на которую отчёт считается начисленным. */
  uploadedAt: Date
}

export type AdvanceSummary = {
  /** Сколько всего выдано. */
  advanceTotal: number
  /** Сколько из этого уже погашено роялти. */
  advanceRecouped: number
  /** Сколько осталось добить. */
  advanceRemaining: number
}

function toTime(value: Date): number {
  const ts = value instanceof Date ? value.getTime() : Number.NaN
  return Number.isNaN(ts) ? 0 : ts
}

/** Копейки: суммы приходят из Float, накопленная погрешность здесь не нужна. */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function computeAdvanceSummary(
  advances: AdvanceInput[],
  reports: RecoupableReport[]
): AdvanceSummary {
  const outstanding = advances
    .filter((a) => Number.isFinite(a.amount) && a.amount > 0)
    .map((a) => ({ issuedAt: toTime(a.issuedAt), remaining: a.amount }))
    .sort((a, b) => a.issuedAt - b.issuedAt)

  const advanceTotal = round2(outstanding.reduce((sum, a) => sum + a.remaining, 0))
  if (advanceTotal <= 0) {
    return { advanceTotal: 0, advanceRecouped: 0, advanceRemaining: 0 }
  }

  const chronological = reports
    .filter((r) => Number.isFinite(r.amount) && r.amount > 0)
    .map((r) => ({ amount: r.amount, at: toTime(r.uploadedAt) }))
    .sort((a, b) => a.at - b.at)

  let recouped = 0
  for (const report of chronological) {
    let available = report.amount
    for (const advance of outstanding) {
      // Авансы отсортированы по дате: если этот выдан позже отчёта, то и все
      // следующие тоже — дальше идти незачем.
      if (advance.issuedAt > report.at) break
      if (advance.remaining <= 0) continue
      const applied = Math.min(advance.remaining, available)
      advance.remaining -= applied
      available -= applied
      recouped += applied
      if (available <= 0) break
    }
  }

  const advanceRecouped = round2(Math.min(recouped, advanceTotal))
  return {
    advanceTotal,
    advanceRecouped,
    advanceRemaining: round2(advanceTotal - advanceRecouped),
  }
}

/**
 * Доступно к выплате с учётом аванса.
 *
 * `unpaidBalance` — начислено минус отмеченное как выплаченное.
 * Порог `minPayout` — та же минимальная сумма, что и без аванса.
 */
export function applyAdvanceToPayout(
  unpaidBalance: number,
  advanceRecouped: number,
  minPayout: number
): number {
  const base = round2(Math.max(0, unpaidBalance - advanceRecouped))
  return base >= minPayout ? base : 0
}
