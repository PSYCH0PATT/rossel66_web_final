/**
 * Next.js Instrumentation
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { log } from './lib/logger'

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return
  }

  if (process.env.SENTRY_DSN) {
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

  const { initScheduler } = await import('./lib/scheduler')
  initScheduler()
}
