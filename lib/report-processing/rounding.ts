/**
 * Округление, совместимое с `round()` из Python.
 *
 * Отчёты считались питоном, и суммы округлялись шесть раз на разных этапах —
 * от способа округления зависят копейки в каждом отчёте артиста. Просто взять
 * `Math.round(x * 100) / 100` нельзя: расходится с питоном на реальных суммах.
 *
 * Два отличия, оба проверены на 618 значениях против настоящего Python:
 *
 * 1. **Половина округляется к чётному**, а не вверх: `0.125 → 0.12`, `2.5 → 2`.
 * 2. **Сравнение идёт по точному значению double**, а не по десятичной записи.
 *    `2.675` в двоичном виде чуть меньше своей записи, поэтому питон даёт `2.67`,
 *    а наивная реализация — `2.68`. И наоборот: `2106.775` чуть больше, и питон
 *    даёт `2106.78`.
 *
 * Отсюда реализация: берём точное десятичное разложение double через `toFixed`,
 * отрезаем хвост и сравниваем его с «половиной» строкой — так исключены любые
 * ошибки промежуточных умножений.
 */

/** Точность разложения: с запасом покрывает 17 значащих цифр double. */
const EXPANSION_DIGITS = 20

export function pyRound(value: number, digits = 2): number {
  if (!Number.isFinite(value)) return value
  // toFixed переходит в экспоненциальную запись на очень больших числах —
  // для денег недостижимо, но лучше вернуть значение как есть, чем мусор.
  if (Math.abs(value) >= 1e21) return value

  const negative = value < 0
  const expansion = Math.abs(value).toFixed(EXPANSION_DIGITS)
  const dot = expansion.indexOf(".")

  const head = expansion.slice(0, dot) + expansion.slice(dot + 1, dot + 1 + digits)
  const tail = expansion.slice(dot + 1 + digits)

  let scaled = BigInt(head)
  const half = "5" + "0".repeat(Math.max(0, tail.length - 1))
  const comparison = tail.localeCompare(half)

  if (comparison > 0) {
    scaled += 1n
  } else if (comparison === 0 && scaled % 2n !== 0n) {
    // Ровно половина — к ближайшему чётному.
    scaled += 1n
  }

  const result = Number(scaled) / 10 ** digits
  return negative ? -result : result
}
