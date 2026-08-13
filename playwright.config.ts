import { defineConfig, devices } from "@playwright/test"
import { existsSync, readFileSync } from "fs"
import { resolve } from "path"

/** Load .env.e2e.local into process.env without overwriting existing keys. */
function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq <= 0) continue
    const key = t.slice(0, eq).trim()
    let value = t.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

// .env.e2e первым: значения стенда должны перебивать прод-креды из .env.local,
// иначе голый `playwright test` уйдёт в боевой Supabase.
loadEnvFile(resolve(process.cwd(), ".env.e2e"))
loadEnvFile(resolve(process.cwd(), ".env.e2e.local"))
loadEnvFile(resolve(process.cwd(), ".env.local"))

const remoteBaseURL = process.env.E2E_BASE_URL?.trim()
const useLocalServer = !remoteBaseURL

// Local runs must hit sandbox queues — prefer E2E_* IDs over prod BUILDIN_DB_* from .env.local
if (useLocalServer) {
  for (const [from, to] of [
    ["E2E_BUILDIN_DB_SUBMISSIONS", "BUILDIN_DB_SUBMISSIONS"],
    ["E2E_BUILDIN_DB_FORM_BACK_CATALOG", "BUILDIN_DB_FORM_BACK_CATALOG"],
    ["E2E_BUILDIN_DB_FORM_RELEASE_UPLOAD", "BUILDIN_DB_FORM_RELEASE_UPLOAD"],
    ["E2E_BUILDIN_DB_FORM_DISTRIBUTION", "BUILDIN_DB_FORM_DISTRIBUTION"],
    ["E2E_BUILDIN_DB_PII_RF", "BUILDIN_DB_PII_RF"],
    ["E2E_BUILDIN_DB_PII_NOT_RF", "BUILDIN_DB_PII_NOT_RF"],
  ] as const) {
    if (process.env[from]) {
      process.env[to] = process.env[from]
    }
  }
}
const baseURL =
  remoteBaseURL ||
  process.env.PLAYWRIGHT_BASE_URL?.trim() ||
  "http://127.0.0.1:3000"

const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim()

// forms.spec.ts сверяет доставку заявок через живой Buildin (assertBuildinSubmissionExists),
// поэтому в полностью локальном стенде он работать не может. Он покрыт отдельным
// workflow forms-biweekly.yml, где есть доступы к песочнице Buildin.
const hasBuildinAccess = Boolean(process.env.BUILDIN_API_TOKEN?.trim()) &&
  !["0", "false", "off"].includes((process.env.E2E_VERIFY_BUILDIN ?? "").toLowerCase())
if (!hasBuildinAccess) {
  console.log("[e2e] forms.spec.ts пропущен: нужен доступ к Buildin (BUILDIN_API_TOKEN)")
}

export default defineConfig({
  testDir: "tests/e2e",
  ...(hasBuildinAccess ? {} : { testIgnore: ["**/forms.spec.ts"] }),
  // Локально: сид базы и стаб Storage. На удалённом стенде не нужно.
  ...(useLocalServer ? { globalSetup: resolve(__dirname, "tests/e2e/global-setup.ts") } : {}),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["json", { outputFile: "test-results/e2e-summary.json" }],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    extraHTTPHeaders: bypass
      ? {
          "x-vercel-protection-bypass": bypass,
          "x-vercel-set-bypass-cookie": "true",
        }
      : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Local: exercise the commit under test against sandbox BUILDIN_DB_* from .env.e2e.local.
  // CI: set E2E_BASE_URL to staging — no webServer, same algorithm on the deployed app.
  ...(useLocalServer
    ? {
        webServer: {
          command: "pnpm exec next start -p 3000",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            ...process.env,
            PORT: "3000",
          },
        },
      }
    : {}),
})
