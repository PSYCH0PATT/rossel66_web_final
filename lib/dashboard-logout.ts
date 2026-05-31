import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"

/** Clears session cookie on server; no local user cache. */
export async function dashboardLogout(router: AppRouterInstance): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" })
  } catch {
    /* still navigate away */
  }
  router.push("/dashboard/login")
}
