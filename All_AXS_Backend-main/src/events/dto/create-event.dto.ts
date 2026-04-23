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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventType } from 'src/domain/enums';

export class CreateEventDto {
  @ApiProperty({ description: 'Event title', maxLength: 180 })
  @IsString()
  @MaxLength(180, { message: 'Title must be at most 180 characters' })
  title!: string;

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

  @ApiProperty({ enum: EventType, description: 'Event type' })
  @IsEnum(EventType)
  type!: EventType;

  @ApiPropertyOptional({
    description: 'Venue (required for IN_PERSON and HYBRID events)',
  })
  @ValidateIf(
    (o: CreateEventDto) =>
      o.type === EventType.IN_PERSON || o.type === EventType.HYBRID,
  )
  @IsString()
  venue?: string;

  @ApiProperty({ description: 'Event start date/time (ISO 8601)' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ description: 'Event end date/time (ISO 8601)' })
  @IsDateString()
  endsAt!: string;
}
