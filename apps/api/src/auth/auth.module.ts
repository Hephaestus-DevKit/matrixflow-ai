import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET', 'dev-only-change-me'),
        signOptions: {
          expiresIn: cfg.get('JWT_ACCESS_TTL', '15m'),
          issuer: cfg.get('JWT_ISSUER', 'matrixflow.ai'),
          audience: cfg.get('JWT_AUDIENCE', 'matrixflow-api'),
          algorithm: 'HS256',
        },
        verifyOptions: {
          issuer: cfg.get('JWT_ISSUER', 'matrixflow.ai'),
          audience: cfg.get('JWT_AUDIENCE', 'matrixflow-api'),
          algorithms: ['HS256'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
