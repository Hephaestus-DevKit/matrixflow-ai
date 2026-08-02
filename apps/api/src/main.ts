import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { API_PREFIX } from '@matrixflow/shared';

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
    ? allowedOriginsStr.split(',').map((origin) => origin.trim()).filter(Boolean)
    : process.env.NODE_ENV === 'production' ? false : true;

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.use(helmet(process.env.NODE_ENV === 'production' ? {
    frameguard: { action: 'deny' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        styleSrc: ["'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        frameAncestors: ["'none'"],
      },
    },
  } : { contentSecurityPolicy: false }));
  app.use(cookieParser());

  // Serve a beautiful Morandi HTML card at root / for Hugging Face preview compatibility
  server.get('/', (req: any, res: any) => {
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>MatrixFlow AI API</title>
          <style>
            body { font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f7f5f0; color: #343c44; margin: 0; }
            .card { text-align: center; padding: 2.5rem; border-radius: 16px; background: #fbfbf9; border: 1px solid #dedad0; box-shadow: 0 4px 12px 0 rgba(0,0,0,0.03); max-width: 400px; width: 90%; }
            .logo { display: inline-flex; height: 40px; width: 40px; align-items: center; justify-content: center; border-radius: 10px; background: #607987; color: white; font-weight: bold; font-size: 1.2rem; margin-bottom: 1.2rem; }
            h1 { color: #343c44; margin: 0 0 8px; font-size: 1.3rem; font-weight: 700; }
            p { margin: 0 0 24px; font-size: 0.85rem; color: #717b84; line-height: 1.5; }
            .badge { display: inline-block; padding: 2px 8px; background: #7b8672; color: white; font-size: 0.7rem; font-weight: bold; border-radius: 10px; margin-bottom: 1rem; }
            a { display: inline-block; text-decoration: none; color: #607987; font-weight: 600; border: 1px solid #607987; padding: 8px 16px; border-radius: 8px; font-size: 0.8rem; transition: all 0.2s; }
            a:hover { background: #607987; color: white; transform: translateY(-1px); }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="logo">M</div>
            <div class="badge">Running Online</div>
            <h1>MatrixFlow AI 后端 API</h1>
            <p>您的 NestJS 服务已成功部署并运行在 Hugging Face Docker Space 节点上！</p>
            <a href="/api/v1/health" target="_blank">🚀 运行 API 健康检查</a>
          </div>
        </body>
      </html>
    `);
  });

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

function validateEnvironment() {
  if (process.env.NODE_ENV !== 'production') return;
  const required = ['DATABASE_URL', 'REDIS_URL', 'CORS_ALLOWED_ORIGINS', 'MINIO_ENDPOINT', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY', 'INTERNAL_JOB_SECRET'];
  if ((process.env.AUTH_MODE ?? 'appwrite') === 'appwrite') required.push('APPWRITE_PROJECT_ID');
  if ((process.env.AUTH_MODE ?? 'appwrite') === 'local') required.push('JWT_SECRET');
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
  if (!process.env.GLM_API_KEY?.trim() && !process.env.OPENAI_API_KEY?.trim()) throw new Error('At least one AI provider API key is required');
  if (process.env.CORS_ALLOWED_ORIGINS?.split(',').some((origin) => origin.trim() === '*')) throw new Error('Wildcard CORS is not allowed with credentials');
  if ((process.env.AUTH_MODE ?? 'appwrite') === 'appwrite' && !process.env.APPWRITE_ENDPOINT?.startsWith('https://')) {
    throw new Error('APPWRITE_ENDPOINT must use HTTPS in production');
  }
  if ((process.env.INTERNAL_JOB_SECRET?.length ?? 0) < 32) throw new Error('INTERNAL_JOB_SECRET must contain at least 32 characters');
  if ((process.env.AUTH_MODE ?? 'appwrite') === 'local' && (process.env.JWT_SECRET?.length ?? 0) < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters');
  }
}
bootstrap().catch((e) => { console.error(e); process.exit(1); });
