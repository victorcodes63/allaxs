import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type TurnstileVerifyResponse = {
  success?: boolean;
  'error-codes'?: string[];
};

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return !!this.configService.get<string>('TURNSTILE_SECRET_KEY')?.trim();
  }

  async assertValidToken(token: string | undefined, ip?: string): Promise<void> {
    const secret = this.configService.get<string>('TURNSTILE_SECRET_KEY')?.trim();
    if (!secret) {
      if (this.configService.get<string>('NODE_ENV') === 'production') {
        this.logger.warn(
          'TURNSTILE_SECRET_KEY is not set — auth captcha checks are disabled until configured.',
        );
      }
      return;
    }

    if (!token?.trim()) {
      throw new BadRequestException({
        message: 'Please complete the security check.',
        code: 'captchaRequired',
      });
    }

    const body = new URLSearchParams({
      secret,
      response: token.trim(),
    });
    if (ip?.trim()) {
      body.set('remoteip', ip.trim());
    }

    let data: TurnstileVerifyResponse;
    try {
      const response = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        { method: 'POST', body },
      );
      data = (await response.json()) as TurnstileVerifyResponse;
    } catch (error) {
      this.logger.error(`Turnstile verify failed: ${(error as Error).message}`);
      throw new BadRequestException({
        message: 'Security verification failed. Try again.',
        code: 'captchaFailed',
      });
    }

    if (!data.success) {
      throw new BadRequestException({
        message: 'Security verification failed. Try again.',
        code: 'captchaFailed',
      });
    }
  }
}
