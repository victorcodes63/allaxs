import { IsOptional, IsString, MinLength } from 'class-validator';

export class PushSubscribeDto {
  @IsString()
  @MinLength(8)
  endpoint!: string;

  @IsString()
  @MinLength(8)
  p256dh!: string;

  @IsString()
  @MinLength(8)
  auth!: string;

  @IsOptional()
  @IsString()
  userAgent?: string;
}
