/**
 * Next.js Instrumentation
 * Этот файл выполняется при старте сервера
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Запускаем только на сервере (не на edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initScheduler } = await import('./lib/scheduler');
    initScheduler();
  }
}


