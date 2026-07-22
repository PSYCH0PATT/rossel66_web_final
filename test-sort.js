const allMatches = [
  { id: '1', releaseDate: '29.05.2026', createdAt: new Date('2026-05-20') },
  { id: '2', releaseDate: '22.05.2026', createdAt: new Date('2026-05-21') },
  { id: '3', releaseDate: '22.05.2026', createdAt: new Date('2026-05-22') },
  { id: '4', releaseDate: '29.05.2026', createdAt: new Date('2026-05-23') },
  { id: '5', releaseDate: '01.05.2026', createdAt: new Date('2026-05-24') },
  { id: '6', releaseDate: '15.05.2026', createdAt: new Date('2026-05-25') },
  { id: '7', releaseDate: '29.05.2026', createdAt: new Date('2026-05-26') },
  { id: '8', releaseDate: '15.05.2026', createdAt: new Date('2026-05-27') },
  { id: '9', releaseDate: '08.05.2026', createdAt: new Date('2026-05-28') },
];

const parseDate = (dStr) => {
  if (!dStr || dStr === "--") return 0
  const parts = dStr.split(".")
  if (parts.length === 3) {
    const [d, m, y] = parts
    return new Date(`${y}-${m}-${d}`).getTime()
  }
  return 0
}

allMatches.sort((a, b) => {
  const timeA = parseDate(a.releaseDate)
  const timeB = parseDate(b.releaseDate)
  if (timeA !== timeB) {
    return timeB - timeA // Descending: newest first
  }
  return b.createdAt.getTime() - a.createdAt.getTime()
})

console.log(allMatches.map(m => m.releaseDate))
