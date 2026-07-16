import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsOptional()
  @IsString()
  turnstileToken?: string;
}
