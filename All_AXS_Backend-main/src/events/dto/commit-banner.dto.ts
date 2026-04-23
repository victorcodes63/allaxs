import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CommitBannerDto {
  @ApiProperty({
    description:
      'Banner URL (must match pattern: events/{eventId}/banner.{ext}). Can be absolute URL or relative path.',
    example: '/static/events/123e4567-e89b-12d3-a456-426614174000/banner.jpg',
  })
  @IsString()
  // Allow both absolute URLs and relative paths
  // Pattern matches: /static/events/{id}/banner.{ext} or http(s)://.../events/{id}/banner.{ext}
  @Matches(/^(https?:\/\/|\/).*events\/[^/]+\/banner\.\w+$/, {
    message:
      'URL must be an absolute URL or relative path matching pattern: events/{eventId}/banner.{ext}',
  })
  url!: string;
}
