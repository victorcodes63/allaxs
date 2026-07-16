import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  /** When "host", credentials must belong to an existing organizer account. */
  @IsOptional()
  @IsIn(['attend', 'host'])
  intent?: 'attend' | 'host';

  /** Cloudflare Turnstile token — required when TURNSTILE_SECRET_KEY is set. */
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}
