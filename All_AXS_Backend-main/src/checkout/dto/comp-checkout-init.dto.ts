import { IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CompCheckoutInitDto {
  @IsString()
  @Length(1, 200)
  slug!: string;

  @IsString()
  @Length(16, 64)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'compToken must be URL-safe',
  })
  compToken!: string;

  @IsString()
  buyerName!: string;

  @IsEmail()
  buyerEmail!: string;

  @IsOptional()
  @IsString()
  buyerPhone?: string;
}
