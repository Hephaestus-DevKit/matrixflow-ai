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

async function bootstrap() {
  validateEnvironment();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const server = app.getHttpAdapter().getInstance();
  server.set('trust proxy', Math.max(0, Number(process.env.TRUST_PROXY_HOPS ?? 0)));
  app.useLogger(app.get(PinoLogger));

  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  const allowedOriginsStr = process.env.CORS_ALLOWED_ORIGINS ?? process.env.CORS_ORIGINS;
  const allowedOrigins = allowedOriginsStr
    ? allowedOriginsStr
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : process.env.NODE_ENV === 'production'
      ? false
      : true;

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.use(
    helmet(
      process.env.NODE_ENV === 'production'
        ? {
            frameguard: { action: 'deny' },
            contentSecurityPolicy: {
              directives: {
                defaultSrc: ["'none'"],
                styleSrc: ["'unsafe-inline'"],
                imgSrc: ["'self'", 'data:'],
                frameAncestors: ["'none'"],
              },
            },
          }
        : { contentSecurityPolicy: false },
    ),
  );
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

function validateEnvironment() {
  if (process.env.NODE_ENV !== 'production') return;
  const required = [
    'DATABASE_URL',
    'REDIS_URL',
    'CORS_ALLOWED_ORIGINS',
    'MINIO_ENDPOINT',
    'MINIO_ACCESS_KEY',
    'MINIO_SECRET_KEY',
    'INTERNAL_JOB_SECRET',
  ];
  if ((process.env.AUTH_MODE ?? 'appwrite') === 'appwrite') required.push('APPWRITE_PROJECT_ID');
  if ((process.env.AUTH_MODE ?? 'appwrite') === 'local') required.push('JWT_SECRET');
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length)
    throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
  if (!process.env.GLM_API_KEY?.trim() && !process.env.OPENAI_API_KEY?.trim())
    throw new Error('At least one AI provider API key is required');
  if (process.env.CORS_ALLOWED_ORIGINS?.split(',').some((origin) => origin.trim() === '*'))
    throw new Error('Wildcard CORS is not allowed with credentials');
  if (
    (process.env.AUTH_MODE ?? 'appwrite') === 'appwrite' &&
    !process.env.APPWRITE_ENDPOINT?.startsWith('https://')
  ) {
    throw new Error('APPWRITE_ENDPOINT must use HTTPS in production');
  }
  if ((process.env.INTERNAL_JOB_SECRET?.length ?? 0) < 32)
    throw new Error('INTERNAL_JOB_SECRET must contain at least 32 characters');
  if ((process.env.METRICS_TOKEN?.length ?? 0) < 32)
    throw new Error('METRICS_TOKEN must contain at least 32 characters');
  if (
    (process.env.AUTH_MODE ?? 'appwrite') === 'local' &&
    (process.env.JWT_SECRET?.length ?? 0) < 32
  ) {
    throw new Error('JWT_SECRET must contain at least 32 characters');
  }
}
bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
