import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FileService } from './file.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [{ provide: FileService, inject: [ConfigService], useFactory: (cfg: ConfigService) => new FileService(cfg.get('MINIO_ENDPOINT', 'http://localhost:9000'), cfg.get('MINIO_ACCESS_KEY', 'matrixflow'), cfg.get('MINIO_SECRET_KEY', 'matrixflow123'), cfg.get('MINIO_BUCKET', 'matrixflow')) }],
  exports: [FileService],
})
export class FileModule {}
