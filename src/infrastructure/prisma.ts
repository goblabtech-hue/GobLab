import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function crear() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('Falta DATABASE_URL. Copia .env.example a .env y llénala.')
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

export const prisma = globalForPrisma.prisma ?? crear()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
