import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, EventStatus } from '../domain/enums';
import { StorageService } from '../storage/storage.service';
import { EventsService } from './events.service';
import { InitBannerUploadDto } from './dto/init-banner-upload.dto';
import {
  generateEventBannerKey,
  parseAllowedMimeTypes,
  validateMimeType,
} from '../storage/utils/storage.utils';
import { ConfigService } from '@nestjs/config';

@ApiTags('uploads')
@Controller('uploads/events')
export class UploadsController {
  private readonly allowedMimeTypes: Set<string>;
  private readonly maxSizeBytes: number;

  constructor(
    private readonly storageService: StorageService,
    private readonly eventsService: EventsService,
    private readonly configService: ConfigService,
  ) {
    // Parse allowed MIME types at startup
    const mimeString = this.configService.get<string>('UPLOAD_ALLOWED_MIME');
    this.allowedMimeTypes = parseAllowedMimeTypes(mimeString);

    // Get max size in bytes
    const maxMB = this.configService.get<number>('UPLOAD_MAX_MB', 10);
    this.maxSizeBytes = maxMB * 1024 * 1024;
  }

  /**
   * Initialize banner upload
   * POST /uploads/events/:eventId/banner/init
   */
  @Post(':eventId/banner/init')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initialize banner upload' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiBody({ type: InitBannerUploadDto })
  @ApiResponse({
    status: 200,
    description: 'Upload initialized',
    schema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['direct', 'presigned'] },
        directUpload: { type: 'boolean' },
        finalPathHint: { type: 'string' },
        eventId: { type: 'string' },
        key: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async initBannerUpload(
    @Param('eventId') eventId: string,
    @GetUser() user: CurrentUser,
    @Body() dto: InitBannerUploadDto,
  ) {
    // Ensure user owns the event and it's in editable status
    const event = await this.eventsService.ensureOwnership(eventId, user.id);

    if (
      event.status !== EventStatus.DRAFT &&
      event.status !== EventStatus.PENDING_REVIEW &&
      event.status !== EventStatus.REJECTED
    ) {
      throw new ForbiddenException(
        'Banner can only be uploaded for events in DRAFT, PENDING_REVIEW, or REJECTED status',
      );
    }

    // Validate MIME type
    if (!validateMimeType(dto.mime, this.allowedMimeTypes)) {
      throw new BadRequestException(
        `MIME type '${dto.mime}' is not allowed. Allowed types: ${Array.from(this.allowedMimeTypes).join(', ')}`,
      );
    }

    // Validate size
    if (dto.size > this.maxSizeBytes) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxSizeBytes / 1024 / 1024}MB`,
      );
    }

    // Generate storage key
    const key = generateEventBannerKey(eventId, dto.mime);

    // Initialize upload
    const storage = this.storageService.getDriver();
    const result = await storage.initUpload({
      key,
      contentType: dto.mime,
      contentLength: dto.size,
    });

    // Return result with eventId and finalUrl for client reference
    // The finalUrl should be used when committing the banner
    return {
      ...result,
      eventId,
      key, // Include key for debugging/reference
      // finalUrl is already included in result for presigned mode
      // For direct mode, use finalPathHint
    };
  }

  /**
   * Direct upload (local storage only)
   * POST /uploads/events/:eventId/banner/direct
   */
  @Post(':eventId/banner/direct')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max (will be validated further)
      },
    }),
  )
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload banner file directly' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Banner image file',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'File uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        finalUrl: { type: 'string' },
        event: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async directBannerUpload(
    @Param('eventId') eventId: string,
    @GetUser() user: CurrentUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const storage = this.storageService.getDriver();
    if (!storage.saveDirect) {
      throw new BadRequestException(
        'Direct upload is not available with the configured storage driver',
      );
    }

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Ensure user owns the event and it's in editable status
    const event = await this.eventsService.ensureOwnership(eventId, user.id);

    if (
      event.status !== EventStatus.DRAFT &&
      event.status !== EventStatus.PENDING_REVIEW &&
      event.status !== EventStatus.REJECTED
    ) {
      throw new ForbiddenException(
        'Banner can only be uploaded for events in DRAFT, PENDING_REVIEW, or REJECTED status',
      );
    }

    // Validate MIME type
    if (!validateMimeType(file.mimetype, this.allowedMimeTypes)) {
      throw new BadRequestException(
        `MIME type '${file.mimetype}' is not allowed. Allowed types: ${Array.from(this.allowedMimeTypes).join(', ')}`,
      );
    }

    // Validate size
    if (file.size > this.maxSizeBytes) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxSizeBytes / 1024 / 1024}MB`,
      );
    }

    // Generate storage key
    const key = generateEventBannerKey(eventId, file.mimetype);

    // Save file
    const finalUrl = await storage.saveDirect({ key, file });

    // Auto-commit the banner URL for direct uploads
    await this.eventsService.commitBanner(eventId, user.id, finalUrl);

    return {
      finalUrl,
      event: await this.eventsService.findById(eventId, user.id, user.roles),
    };
  }
}
