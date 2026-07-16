import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ResendVerificationDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsOptional()
  @IsString()
  turnstileToken?: string;
}
