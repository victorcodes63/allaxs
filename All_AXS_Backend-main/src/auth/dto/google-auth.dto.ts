import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GoogleAuthDto {
  @IsString()
  @IsNotEmpty()
  credential!: string;

  @IsOptional()
  @IsIn(['attend', 'host'])
  intent?: 'attend' | 'host';

  @IsOptional()
  @IsString()
  turnstileToken?: string;
}
