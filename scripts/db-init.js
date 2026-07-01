const path = require('path');
const fs = require('fs');

async function main() {
  console.log("=== Database Pre-Initialization ===");
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  
  let clientPath = '@prisma/client';
  const localClient = path.join(__dirname, '../packages/db/src/generated/client');
  if (fs.existsSync(localClient)) {
    clientPath = localClient;
  }
  
  console.log(`Loading Prisma client from: ${clientPath}`);
  const { PrismaClient } = require(clientPath);
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  try {
    console.log("Connecting to database and enabling pgvector...");
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log("pgvector extension enabled.");
  } catch (e) {
    console.error("Warning: Could not enable pgvector extension:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error("Database pre-init script crashed:", err);
  process.exit(1);
});
