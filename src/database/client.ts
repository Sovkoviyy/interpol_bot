import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// Гарантируем существование директории для базы SQLite (например prisma/data)
const dbUrl = process.env.DATABASE_URL;
if (dbUrl && dbUrl.startsWith('file:')) {
  try {
    const rawPath = dbUrl.replace(/^file:/, '').replace(/^\/\//, '');
    const absPath = path.isAbsolute(rawPath)
      ? rawPath
      : path.resolve(process.cwd(), 'prisma', rawPath);
    const dbDir = path.dirname(absPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  } catch (e) {}
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
