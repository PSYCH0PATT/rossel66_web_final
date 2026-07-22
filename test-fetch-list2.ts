import { buildSessionCookieValue } from './lib/server-auth'

async function main() {
  const cookieVal = buildSessionCookieValue({ id: "admin", username: "admin", role: "admin" })
  const res = await fetch('http://localhost:3000/api/releases?page=1&pageSize=20', {
    headers: { 'cookie': 'rossel_session=' + cookieVal }
  })
  const text = await res.json()
  console.log("FIRST:", text.releases[0].title, text.releases[0].id)
  console.log("TRACKS:", text.releases[0].tracks?.length)
  process.exit(0)
}
main()
