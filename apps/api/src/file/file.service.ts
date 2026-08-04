import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';

@Injectable()
export class FileService implements OnModuleInit {
  private readonly logger = new Logger(FileService.name);
  private client: Minio.Client;
  private bucket: string;
  constructor(
    private endpoint: string,
    private accessKey: string,
    private secretKey: string,
    bucket: string,
  ) {
    this.bucket = bucket;
    const url = new URL(endpoint);
    this.client = new Minio.Client({
      endPoint: url.hostname,
      port: Number(url.port) || (url.protocol === 'https:' ? 443 : 80),
      useSSL: url.protocol === 'https:',
      accessKey,
      secretKey,
    });
  }
  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) await this.client.makeBucket(this.bucket);
    } catch (e) {
      this.logger.error(`MinIO init failed: ${(e as Error).message}`);
    }
  }
  async upload(key: string, buf: Buffer, contentType: string) {
    await this.client.putObject(this.bucket, key, buf, buf.length, { 'Content-Type': contentType });
  }
  async download(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(c);
    return Buffer.concat(chunks);
  }
  async delete(key: string) {
    await this.client.removeObject(this.bucket, key);
  }
  async presignedUrl(key: string, ttlSec = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, ttlSec);
  }
  async health(): Promise<boolean> {
    return this.client.bucketExists(this.bucket);
  }
}
