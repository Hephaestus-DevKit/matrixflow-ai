import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { API_PREFIX } from '@matrixflow/shared';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));

  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
    credentials: true,
  });
  app.use(helmet());
  app.use(cookieParser());

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, transform: true, forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder().setTitle('MatrixFlow AI API').setVersion('1.0').addBearerAuth().build();
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, SwaggerModule.createDocument(app, config));
  }

  const port = Number(process.env.PORT ?? 7860);
  await app.listen(port);
  new Logger('Bootstrap').log(`🚀 API on http://localhost:${port}${API_PREFIX}`);
}
bootstrap().catch((e) => { console.error(e); process.exit(1); });
