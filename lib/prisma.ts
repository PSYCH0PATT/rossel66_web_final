import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

// Local-only: never load a filesystem `.env` on Vercel/production (can override or
// corrupt DATABASE_URL from project env vars when CLI uploads a stray file).
if (
  process.env.NODE_ENV !== 'production' &&
  !process.env.VERCEL &&
  typeof process.loadEnvFile === 'function'
) {
  try {
    // @ts-ignore
    process.loadEnvFile('.env')
  } catch (e) {}
}

const globalForPrisma = globalThis as unknown as { 
  prisma: PrismaClient
  pool: Pool
  prismaAdapter: PrismaPg
}

if (!globalForPrisma.pool) {
  globalForPrisma.pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30_000,
  })
}

if (!globalForPrisma.prismaAdapter) {
  globalForPrisma.prismaAdapter = new PrismaPg(globalForPrisma.pool)
}

export const prisma = globalForPrisma.prisma || new PrismaClient({ 
  adapter: globalForPrisma.prismaAdapter,
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
