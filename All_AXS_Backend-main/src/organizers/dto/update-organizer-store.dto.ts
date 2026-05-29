import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateOrganizerStoreDto {
  @ApiPropertyOptional({ example: 'my-events' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @ValidateIf((_, value) => value !== undefined && value !== '')
  @Matches(/^[a-z0-9](-?[a-z0-9])*$/, {
    message:
      'Slug must use lowercase letters, numbers, and hyphens (e.g. my-events)',
  })
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ValidateIf((_, value) => value !== undefined && value !== '')
  @IsUrl({}, { message: 'Logo URL must be a valid URL' })
  logoUrl?: string;

  @ApiPropertyOptional({ example: '#F07241' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Brand color must be a hex color like #F07241',
  })
  brandColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
