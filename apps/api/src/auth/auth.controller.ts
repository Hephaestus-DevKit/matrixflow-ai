import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  NotFoundException,
  Post,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../common/guards/jwt-auth.guard';
import { ErrorCode, refreshTokenSchema, updateProfileSchema } from '@matrixflow/shared';
import { RateLimit } from '../common/guards/rate-limit.guard';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @RateLimit({ name: 'auth-register', max: 5, windowSeconds: 3_600, failClosed: true })
  @Post('register')
  @HttpCode(201)
  register(@Body() body: unknown, @Ip() ip: string, @Headers('user-agent') ua: string) {
    this.ensureLocalAuthEnabled();
    return this.auth.register(body, ip, ua);
  }

  @Public()
  @RateLimit({ name: 'auth-login', max: 10, windowSeconds: 60, failClosed: true })
  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown, @Ip() ip: string, @Headers('user-agent') ua: string) {
    this.ensureLocalAuthEnabled();
    return this.auth.login(body, ip, ua);
  }

  @Public()
  @RateLimit({ name: 'auth-refresh', max: 30, windowSeconds: 60, failClosed: true })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() body: unknown) {
    this.ensureLocalAuthEnabled();
    const { refreshToken } = refreshTokenSchema.parse(body);
    if (!refreshToken) throw new UnauthorizedException(ErrorCode.TOKEN_INVALID);
    return this.auth.refresh(refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Body() body: unknown) {
    this.ensureLocalAuthEnabled();
    const { refreshToken } = refreshTokenSchema.parse(body);
    if (refreshToken) await this.auth.logout(refreshToken);
  }

  @Get('me')
  me(@Req() req: Request) {
    if (!req.user) throw new UnauthorizedException(ErrorCode.UNAUTHORIZED);
    return this.auth.me(req.user.id);
  }

  @Put('me')
  @HttpCode(200)
  updateProfile(@Req() req: Request, @Body() body: unknown) {
    if (!req.user) throw new UnauthorizedException(ErrorCode.UNAUTHORIZED);
    return this.auth.updateProfile(req.user.id, updateProfileSchema.parse(body));
  }

  private ensureLocalAuthEnabled() {
    if ((process.env.AUTH_MODE ?? 'appwrite') !== 'local' && process.env.NODE_ENV !== 'test') {
      throw new NotFoundException();
    }
  }
}
