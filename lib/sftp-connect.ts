/**
 * Общие настройки SSH/SFTP для rossel_flash и rossel_playlist.
 * Решает типичные проблемы: долгий handshake, старые алгоритмы, путь без ведущего «/».
 */
import * as dns from "node:dns/promises"
import * as net from "node:net"
import type SftpClient from "ssh2-sftp-client"

type SftpLike = Pick<SftpClient, "list">

/** Варианты пути с/без ведущего «/» (разные SFTP-серверы). */
export function sftpRemoteDirCandidates(raw: string): string[] {
  const trimmed = raw.trim().replace(/\/+$/, "")
  if (!trimmed) return ["rossel_flash"]
  const set = new Set<string>()
  if (trimmed.startsWith("/")) {
    set.add(trimmed)
    const tail = trimmed.slice(1)
    if (tail) set.add(tail)
  } else {
    set.add(trimmed)
    set.add(`/${trimmed}`)
  }
  return [...set]
}

export type BasicSftpAuth = {
  host: string
  port: number
  username: string
  password: string
}

/** Параметры для ssh2-sftp-client .connect() */
export function sftpConnectOptions(params: BasicSftpAuth): Record<string, unknown> {
  const readyTimeout = parseInt(process.env.SFTP_READY_TIMEOUT_MS || "60000", 10)
  const keepaliveInterval = parseInt(process.env.SFTP_KEEPALIVE_INTERVAL_MS || "10000", 10)

  const base: Record<string, unknown> = {
    host: params.host,
    port: params.port,
    username: params.username,
    password: params.password,
    readyTimeout,
    keepaliveInterval,
    keepaliveCountMax: 3,
  }

  if (process.env.SFTP_DISABLE_LEGACY_HANDSHAKE === "true") {
    return base
  }

  // Расширяем дефолты ssh2 (prepend), чтобы договориться со старыми серверами
  base.algorithms = {
    kex: {
      prepend: [
        "diffie-hellman-group-exchange-sha256",
        "diffie-hellman-group14-sha256",
        "diffie-hellman-group-exchange-sha1",
        "diffie-hellman-group14-sha1",
        "diffie-hellman-group1-sha1",
      ],
    },
    serverHostKey: {
      prepend: ["ssh-rsa", "ssh-dss"],
    },
    cipher: {
      prepend: [
        "aes256-gcm@openssh.com",
        "aes128-gcm@openssh.com",
        "aes256-ctr",
        "aes192-ctr",
        "aes128-ctr",
        "aes256-cbc",
        "aes192-cbc",
        "aes128-cbc",
      ],
    },
    hmac: {
      prepend: ["hmac-sha2-256", "hmac-sha2-512", "hmac-sha1"],
    },
  }

  return base
}

/**
 * При SFTP_IPV4_ONLY=true подключаемся к A-записи явно (обход проблем с AAAA/маршрутизацией).
 */
export async function withIpv4SocketIfRequested(
  opts: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (process.env.SFTP_IPV4_ONLY !== "true") return opts
  const host = String(opts.host || "")
  const port = Number(opts.port || 22)
  const { address } = await dns.lookup(host, { family: 4 })
  const sock = await new Promise<net.Socket>((resolve, reject) => {
    const s = net.createConnection({ host: address, port }, () => resolve(s))
    s.setTimeout(Math.min(30000, Number(opts.readyTimeout) || 30000))
    s.once("error", reject)
  })
  return { ...opts, sock }
}

/** Варианты каталога rossel_flash (аналитика прослушиваний). */
export function flashRemoteDirsToTry(): string[] {
  return sftpRemoteDirCandidates(process.env.SFTP_REMOTE_FLASH_PATH || "rossel_flash")
}

/** Варианты каталога плейлистов (rossel_playlist). */
export function playlistRemoteDirsToTry(): string[] {
  return sftpRemoteDirCandidates(process.env.SFTP_REMOTE_PATH || "rossel_playlist")
}

/** Первый путь из списка, для которого list() успешен. */
export async function resolveSftpRemoteDir(
  sftp: SftpLike,
  candidates: string[]
): Promise<string | null> {
  for (const dir of candidates) {
    try {
      await sftp.list(dir)
      return dir
    } catch {
      /* next */
    }
  }
  return null
}

/** Каталог rossel_flash на сервере. */
export async function resolveFlashRemoteDir(sftp: SftpLike): Promise<string | null> {
  return resolveSftpRemoteDir(sftp, flashRemoteDirsToTry())
}

/** Каталог плейлистов на сервере. */
export async function resolvePlaylistRemoteDir(sftp: SftpLike): Promise<string | null> {
  return resolveSftpRemoteDir(sftp, playlistRemoteDirsToTry())
}
