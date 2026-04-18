/**
 * Next.js Instrumentation
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { log } from './lib/logger'

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return
  }

  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    try {
      const Sentry = await import('@sentry/node')
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.05'),
        environment: process.env.NODE_ENV,
      })
    } catch (e) {
      log.warn('[instrumentation] Sentry init skipped:', e)
    }
  }

  // Не импортировать scheduler по умолчанию: модуль тянет Prisma/node-cron и ломает dev-бандл instrumentation.
  if (process.env.ENABLE_IN_PROCESS_SCHEDULER === 'true') {
    const { initScheduler } = await import('./lib/scheduler')
    initScheduler()
  }
}
