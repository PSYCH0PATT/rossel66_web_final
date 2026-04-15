/**
 * Проверка SFTP: подключение и листинг rossel_flash (аналитика прослушиваний).
 * npx tsx scripts/test-sftp-flash-connection.ts
 */
import SftpClient from "ssh2-sftp-client"
import * as fs from "fs"
import * as path from "path"
import {
  flashRemoteDirsToTry,
  playlistRemoteDirsToTry,
  resolveFlashRemoteDir,
  resolvePlaylistRemoteDir,
  sftpConnectOptions,
  withIpv4SocketIfRequested,
} from "../lib/sftp-connect"

function loadEnvLocal() {
  for (const envFile of [".env.local", ".env"]) {
    const envPath = path.join(process.cwd(), envFile)
    if (!fs.existsSync(envPath)) continue
    const content = fs.readFileSync(envPath, "utf-8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith("#")) {
        const eq = trimmed.indexOf("=")
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim()
          const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
          if (!process.env[key]) process.env[key] = value
        }
      }
    }
  }
}

async function main() {
  loadEnvLocal()
  const username = process.env.SFTP_USERNAME
  const password = process.env.SFTP_PASSWORD
  if (!username || !password) {
    console.error("Нет SFTP_USERNAME / SFTP_PASSWORD")
    process.exit(1)
  }
  const host = process.env.SFTP_HOST || "sftp1.sp-digital.ru"
  const port = parseInt(process.env.SFTP_PORT || "22", 10)

  const sftp = new SftpClient()
  try {
    console.log(`Подключение ${host}:${port}...`)
    if (process.env.SFTP_IPV4_ONLY === "true") {
      console.log("(SFTP_IPV4_ONLY=true — сокет IPv4)")
    }
    const connectOpts = await withIpv4SocketIfRequested(
      sftpConnectOptions({ host, port, username, password })
    )
    await sftp.connect(connectOpts as any)
    console.log("OK: сессия установлена")

    console.log("Варианты rossel_flash:", flashRemoteDirsToTry().join(", "))
    const flashDir = await resolveFlashRemoteDir(sftp)
    if (flashDir) {
      const list = await sftp.list(flashDir)
      const csv = list.filter((f: any) => f.type === "-" && String(f.name).endsWith(".csv"))
      console.log(`OK: flash "${flashDir}" — файлов: ${list.length}, CSV: ${csv.length}`)
    } else {
      console.error("Не удалось открыть ни один вариант пути к rossel_flash")
    }

    console.log("Варианты плейлистов:", playlistRemoteDirsToTry().join(", "))
    const playlistDir = await resolvePlaylistRemoteDir(sftp)
    if (playlistDir) {
      const pl = await sftp.list(playlistDir)
      console.log(`OK: плейлисты "${playlistDir}" — записей: ${pl.length}`)
    } else {
      console.log("Плейлисты: ни один кандидат не открылся")
    }

    await sftp.end()
    console.log("Готово.")
  } catch (e: any) {
    console.error("Ошибка:", e?.message || e)
    await sftp.end().catch(() => {})
    process.exit(1)
  }
}

main()
