import { Equals, IsOptional, IsString, MinLength } from 'class-validator';

export class CloseAccountDto {
  @Equals('CLOSE')
  confirmation!: string;

  /** Required when the account has a password set. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  password?: string;
}
