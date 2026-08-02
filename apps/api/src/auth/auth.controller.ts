import { Body, Controller, Get, Headers, HttpCode, Ip, NotFoundException, Post, Put, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../common/guards/jwt-auth.guard';
import { ErrorCode } from '@matrixflow/shared';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(201)
  register(@Body() body: unknown, @Ip() ip: string, @Headers('user-agent') ua: string) {
    this.ensureLocalAuthEnabled();
    return this.auth.register(body, ip, ua);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown, @Ip() ip: string, @Headers('user-agent') ua: string) {
    this.ensureLocalAuthEnabled();
    return this.auth.login(body, ip, ua);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() body: { refreshToken?: string }) {
    this.ensureLocalAuthEnabled();
    if (!body.refreshToken) throw new UnauthorizedException(ErrorCode.TOKEN_INVALID);
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Body() body: { refreshToken?: string }) {
    this.ensureLocalAuthEnabled();
    if (body.refreshToken) await this.auth.logout(body.refreshToken);
  }

  @Get('me')
  me(@Req() req: Request) {
    if (!req.user) throw new UnauthorizedException(ErrorCode.UNAUTHORIZED);
    return this.auth.me(req.user.id);
  }

  @Put('me')
  @HttpCode(200)
  updateProfile(@Req() req: Request, @Body() body: { name?: string; avatarUrl?: string }) {
    if (!req.user) throw new UnauthorizedException(ErrorCode.UNAUTHORIZED);
    return this.auth.updateProfile(req.user.id, body);
  }

  private ensureLocalAuthEnabled() {
    if ((process.env.AUTH_MODE ?? 'appwrite') !== 'local' && process.env.NODE_ENV !== 'test') {
      throw new NotFoundException();
    }
  }
}
