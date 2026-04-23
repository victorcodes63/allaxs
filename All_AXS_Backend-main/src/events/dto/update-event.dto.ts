import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Exclude } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventType } from 'src/domain/enums';

export class UpdateEventDto {
  @ApiPropertyOptional({ description: 'Event title', maxLength: 180 })
  @IsOptional()
  @IsString()
  @MaxLength(180, { message: 'Title must be at most 180 characters' })
  title?: string;

  @ApiPropertyOptional({ description: 'Event description' })
  @IsOptional()
  @IsString()
  description?: string;

  /**
   * @deprecated bannerUrl should not be set directly. Use /uploads/events/:eventId/banner/init and /events/:id/banner/commit instead.
   */
  @IsOptional()
  @IsUrl()
  @Exclude()
  bannerUrl?: string;

  @ApiPropertyOptional({ enum: EventType, description: 'Event type' })
  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;

  @ApiPropertyOptional({
    description: 'Venue (required for IN_PERSON and HYBRID events)',
  })
  @ValidateIf(
    (o: UpdateEventDto) =>
      o.type === EventType.IN_PERSON || o.type === EventType.HYBRID,
  )
  @IsOptional()
  @IsString()
  venue?: string;

  @ApiPropertyOptional({ description: 'Event start date/time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ description: 'Event end date/time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
