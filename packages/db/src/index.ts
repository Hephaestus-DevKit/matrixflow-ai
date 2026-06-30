// Use WASM Prisma client — works on arm64 Windows without native binary.
// Requires a driver adapter (e.g. @prisma/adapter-pg) to be passed to PrismaClient.
import { PrismaClient } from './generated/client/wasm';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export * from './generated/client/wasm';
