import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import { API_PREFIX } from '@matrixflow/shared';
import { UuidParamPipe } from './common/pipes/uuid-param.pipe';
import {
  createCorsOptions,
  createHelmetOptions,
  validateEnvironment,
} from './config/runtime-security';

async function bootstrap() {
  validateEnvironment(process.env);
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const server = app.getHttpAdapter().getInstance();
  server.set('trust proxy', Math.max(0, Number(process.env.TRUST_PROXY_HOPS ?? 0)));
  app.useLogger(app.get(PinoLogger));

  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  app.enableCors(createCorsOptions(process.env));
  app.use(helmet(createHelmetOptions(process.env)));
  app.use(cookieParser());

  // Hugging Face Docker Spaces expects a useful response at the container root.
  server.get('/', (_request: Request, response: Response) => {
    response.status(200).json({
      name: 'MatrixFlow AI API',
      status: 'ok',
      health: `/${API_PREFIX}/health`,
    });
  });

  app.useGlobalPipes(
    new UuidParamPipe(),
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('MatrixFlow AI API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, SwaggerModule.createDocument(app, config));
  }

  const port = Number(process.env.PORT ?? 7860);
  await app.listen(port);
  new Logger('Bootstrap').log(`🚀 API on http://localhost:${port}${API_PREFIX}`);
}

bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
