// Auth E2E 测试（Jest + Supertest）
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const testEmail = `e2e-${Date.now()}@test.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    prisma = app.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await app.close();
  });

  it('POST /auth/register → 201 + accessToken', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: testEmail, password: 'Test1234!', name: 'E2E Tester' })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.organizationId).toBeDefined();
  });

  it('POST /auth/register duplicate → 409', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: testEmail, password: 'Test1234!', name: 'Dup' })
      .expect(409);
  });

  it('POST /auth/login → 200 + accessToken', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: 'Test1234!' })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('POST /auth/login wrong password → 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: 'WrongPass!' })
      .expect(401);
  });

  it('GET /auth/me → 200 with Bearer', async () => {
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: testEmail, password: 'Test1234!' });
    const token = login.body.accessToken;
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.user.email).toBe(testEmail);
  });

  it('GET /agents without token → 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/agents').expect(401);
  });
});
