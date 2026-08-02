import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import IORedis, { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;
  constructor(private url: string, private prefix: string) {}
  onModuleInit() { this.client = new IORedis(this.url, { maxRetriesPerRequest: null, lazyConnect: false, connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? 10_000), commandTimeout: Number(process.env.REDIS_COMMAND_TIMEOUT_MS ?? 5_000) }); this.client.on('error', () => {}); }
  onModuleDestroy() { this.client?.disconnect(); }
  private k(key: string) { return `${this.prefix}${key}`; }
  async get<T = string>(key: string): Promise<T | null> { const v = await this.client.get(this.k(key)); return v ? (JSON.parse(v) as T) : null; }
  async set(key: string, val: unknown, ttlSec?: number) { const s = JSON.stringify(val); if (ttlSec) await this.client.set(this.k(key), s, 'EX', ttlSec); else await this.client.set(this.k(key), s); }
  async del(key: string) { await this.client.del(this.k(key)); }
  async incr(key: string, ttlSec = 60): Promise<number> { const n = await this.client.incr(this.k(key)); if (n === 1) await this.client.expire(this.k(key), ttlSec); return n; }
  async ping(): Promise<string> { return this.client.ping(); }
  raw(): Redis { return this.client; }
}
