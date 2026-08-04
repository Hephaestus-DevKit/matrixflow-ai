import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@matrixflow/db';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Math.max(1, Number(process.env.DATABASE_POOL_MAX ?? 10)),
      idleTimeoutMillis: Math.max(1_000, Number(process.env.DATABASE_IDLE_TIMEOUT_MS ?? 30_000)),
      connectionTimeoutMillis: Math.max(
        1_000,
        Number(process.env.DATABASE_CONNECT_TIMEOUT_MS ?? 10_000),
      ),
    });
    const adapter = new PrismaPg(pool);
    super({
      adapter,
      omit: {
        user: { passwordHash: true, twoFactorSecret: true },
        account: { accessToken: true, refreshToken: true },
        session: { refreshToken: true },
        integrationAccount: { accessToken: true, refreshToken: true },
      },
    } as Prisma.PrismaClientOptions);
    this.pool = pool;
  }
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
