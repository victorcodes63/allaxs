import { IsString, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitBannerUploadDto {
  @ApiProperty({
    description: 'MIME type of the file',
    example: 'image/jpeg',
    enum: ['image/jpeg', 'image/png', 'image/webp'],
  })
  @IsString()
  mime!: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 1024000,
    minimum: 1,
    maximum: 50 * 1024 * 1024,
  })
  @IsNumber()
  @Min(1)
  @Max(50 * 1024 * 1024) // Max 50MB (will be further validated by server)
  size!: number;
}
