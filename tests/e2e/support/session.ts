/**
 * Программная сессия для e2e.
 *
 * Кука собирается тем же алгоритмом, что и в приложении
 * (lib/server-auth.ts, buildSessionCookieValue): base64url(JSON) + HMAC-SHA256.
 *
 * Почему не логин через HTTP: логин ограничен десятью попытками на IP, а бакет
 * у всех локальных запросов один («login:unknown»), так что десяток тестов с
 * логином начал бы упираться в 429. Один честный UI-логин всё равно проверяется
 * отдельным тестом — здесь важно, чтобы форма и кука работали, а не повторять
 * это в каждом сценарии.
 */
import { createHmac } from "crypto"
import type { BrowserContext, APIRequestContext } from "@playwright/test"

export type SeedUser = {
  id: string
  username: string
  role: "admin" | "artist"
}

/** Пользователи из scripts/seed-e2e.ts. */
export const USERS = {
  admin: { id: "e2e-admin-id", username: "e2e-admin", role: "admin" },
  main: { id: "e2e-main-id", username: "e2e-main", role: "artist" },
  linked: { id: "e2e-linked-id", username: "e2e-linked", role: "artist" },
  solo: { id: "e2e-solo-id", username: "e2e-solo", role: "artist" },
  stranger: { id: "e2e-stranger-id", username: "e2e-stranger", role: "artist" },
} as const satisfies Record<string, SeedUser>

export const SEED_PASSWORD = "e2e-password"

export function buildSessionCookieValue(user: SeedUser): string {
  const secret = process.env.AUTH_SECRET?.trim()
  const payload = Buffer.from(JSON.stringify(user), "utf-8")
  if (!secret) return payload.toString("base64")
  const b64 = payload.toString("base64url")
  const sig = createHmac("sha256", secret).update(b64).digest("base64url")
  return `${b64}.${sig}`
}

function cookieFor(user: SeedUser, baseURL: string) {
  const { hostname } = new URL(baseURL)
  return {
    name: "rossel_session",
    value: buildSessionCookieValue(user),
    domain: hostname,
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax" as const,
  }
}

/** Логинит браузерный контекст под указанным пользователем. */
export async function loginAs(context: BrowserContext, user: SeedUser, baseURL: string) {
  await context.clearCookies()
  await context.addCookies([cookieFor(user, baseURL)])
}

/** Заголовок Cookie для запросов через request-контекст. */
export function sessionHeader(user: SeedUser): Record<string, string> {
  return { cookie: `rossel_session=${buildSessionCookieValue(user)}` }
}

/** GET с сессией указанного пользователя. */
export function getAs(request: APIRequestContext, user: SeedUser, url: string) {
  return request.get(url, { headers: sessionHeader(user) })
}
