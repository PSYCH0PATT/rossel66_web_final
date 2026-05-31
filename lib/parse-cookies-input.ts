/** Shared cookie string / curl parsing for Bandlink and VK admin APIs */

export type ParsedCookiePair = { name: string; value: string }

export function parseCookiesFromInput(input: string): ParsedCookiePair[] {
  const cookies: ParsedCookiePair[] = []

  let cookieString = ""
  const curlMatch = input.match(/-H\s+['"]Cookie:\s*(.+?)['"]/i)
  if (curlMatch) {
    cookieString = curlMatch[1]
  } else {
    cookieString = input
  }

  const lines = cookieString
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line)

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    if (line.includes("=")) {
      const [name, ...valueParts] = line.split("=")
      const value = valueParts.join("=")
      if (name && value) {
        cookies.push({ name: name.trim(), value: value.trim() })
      }
      i++
    } else {
      const parts = line.split(/\s+/)

      if (parts.length >= 2) {
        const name = parts[0]
        const value = parts.slice(1).join(" ")
        if (name) {
          cookies.push({ name: name.trim(), value: value.trim() })
        }
        i++
      } else if (parts.length === 1) {
        const name = parts[0]
        if (name.match(/^[a-zA-Z0-9_\-]+$/)) {
          if (
            i + 1 < lines.length &&
            !lines[i + 1].includes("=") &&
            !lines[i + 1].match(/^[a-zA-Z0-9_\-]+$/)
          ) {
            cookies.push({ name: name.trim(), value: lines[i + 1].trim() })
            i += 2
            continue
          }
        }
        i++
      } else {
        i++
      }
    }
  }

  if (cookies.length === 0) {
    const cookiePairs = cookieString.split(/;\s*/)
    for (const pair of cookiePairs) {
      const [name, ...valueParts] = pair.split("=")
      const value = valueParts.join("=")
      if (name && value) {
        cookies.push({ name: name.trim(), value: value.trim() })
      }
    }
  }

  return cookies
}
