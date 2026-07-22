import { buildSessionCookieValue } from './lib/server-auth'

async function main() {
  const cookieVal = buildSessionCookieValue({ id: "admin", username: "admin", role: "admin" })
  const res = await fetch('http://localhost:3000/api/releases?page=1&pageSize=20', {
    headers: { 'cookie': 'rossel_session=' + cookieVal }
  })
  const text = await res.json()
  for (const r of text.releases) {
    console.log(`Title: ${r.title}, Tracks defined?: ${r.tracks !== undefined}, Tracks Array?: ${Array.isArray(r.tracks)}, Length: ${r.tracks?.length}`)
  }
  process.exit(0)
}
main()
