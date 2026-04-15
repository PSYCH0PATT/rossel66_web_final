import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

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
    connectionTimeoutMillis: 5000,
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
