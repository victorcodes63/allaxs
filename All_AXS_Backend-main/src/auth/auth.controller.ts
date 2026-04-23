import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GetUser } from './decorators/current-user.decorator';
import type { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  private extractMetadata(req: Request) {
    return {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const metadata = this.extractMetadata(req);
    return this.authService.register(dto, metadata);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const metadata = this.extractMetadata(req);
    return this.authService.login(dto, metadata);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body('refreshToken') refreshToken: string,
    @Req() req: Request,
  ) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const metadata = this.extractMetadata(req);
    return this.authService.refreshTokens(refreshToken, metadata);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body('refreshToken') refreshToken: string,
    @GetUser() user?: CurrentUser,
  ) {
    const userId = user?.id;
    await this.authService.logout(userId || '', refreshToken);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(@GetUser() user: CurrentUser) {
    await this.authService.logoutAll(user.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@GetUser() user: CurrentUser) {
    return { user };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    this.logger.log(`Forgot password requested for email: ${dto.email}`);
    const metadata = this.extractMetadata(req);
    const result = await this.authService.forgotPassword(
      dto.email,
      metadata.ipAddress,
    );
    this.logger.log(
      `Forgot password request completed for email: ${dto.email}`,
    );
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password reset successfully.' };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }
}
