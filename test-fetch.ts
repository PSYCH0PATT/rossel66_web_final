import { buildSessionCookieValue } from './lib/server-auth'
import http from 'http'

async function main() {
  const cookieVal = buildSessionCookieValue({ id: "admin", username: "admin", role: "admin" })
  const res = await fetch('http://localhost:3000/api/releases/release_1759097981609_154', {
    headers: { 'cookie': 'rossel_session=' + cookieVal }
  })
  const text = await res.text()
  console.log("STATUS:", res.status)
  console.log("BODY:", text)
  process.exit(0)
}
main()
