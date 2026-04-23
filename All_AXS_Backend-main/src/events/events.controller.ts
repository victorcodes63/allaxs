import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, EventType } from '../domain/enums';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CommitBannerDto } from './dto/commit-banner.dto';
import { StorageService } from '../storage/storage.service';
import { ConfigService } from '@nestjs/config';
import { Event } from './entities/event.entity';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  @Get('public')
  @Public()
  @ApiOperation({ summary: 'List published events for public access' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, enum: EventType })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Events list with pagination' })
  async findPublicEvents(
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('q') q?: string,
    @Query('type') type?: EventType,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('city') city?: string,
  ) {
    return this.eventsService.findPublicEvents({
      page: page ? parseInt(page, 10) : undefined,
      size: size ? parseInt(size, 10) : undefined,
      q,
      type,
      dateFrom,
      dateTo,
      city,
    });
  }

  @Get('by-slug/:slug')
  @Public()
  @ApiOperation({ summary: 'Get published event by slug for public access' })
  @ApiParam({ name: 'slug', description: 'Event slug' })
  @ApiResponse({ status: 200, description: 'Event found', type: Event })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findBySlug(@Param('slug') slug: string) {
    return this.eventsService.findBySlug(slug);
  }

  @Get(':id/slug')
  @Public()
  @ApiOperation({ summary: 'Get event slug by ID for redirects' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({
    status: 200,
    description: 'Slug found',
    schema: { type: 'object', properties: { slug: { type: 'string' } } },
  })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getSlugById(@Param('id') id: string) {
    const slug = await this.eventsService.findSlugById(id);
    return { slug };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List events for the authenticated organizer' })
  @ApiResponse({ status: 200, description: 'Events list', type: [Event] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(@GetUser() user: CurrentUser) {
    return this.eventsService.findByOrganizer(user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new event' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Idempotency key for duplicate request prevention',
  })
  @ApiResponse({ status: 201, description: 'Event created', type: Event })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @GetUser() user: CurrentUser,
    @Body() dto: CreateEventDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.eventsService.create(user.id, dto, idempotencyKey);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get event by ID' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Event found', type: Event })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findOne(@Param('id') id: string, @GetUser() user?: CurrentUser) {
    // Optional auth: if user is authenticated, pass userId and roles for expanded access
    // If not authenticated, service will only return published events
    if (user) {
      return this.eventsService.findById(id, user.id, user.roles);
    }
    return this.eventsService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update event' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Event updated', type: Event })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async update(
    @Param('id') id: string,
    @GetUser() user: CurrentUser,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventsService.update(id, user.id, dto);
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit event for review' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Event submitted', type: Event })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async submitForReview(@Param('id') id: string, @GetUser() user: CurrentUser) {
    return this.eventsService.submitForReview(id, user.id);
  }

  /**
   * Commit banner URL to event
   * POST /events/:id/banner/commit
   */
  @Post(':id/banner/commit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Commit banner URL to event' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiBody({ type: CommitBannerDto })
  @ApiResponse({
    status: 200,
    description: 'Banner URL committed',
    type: Event,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async commitBanner(
    @Param('id') id: string,
    @GetUser() user: CurrentUser,
    @Body() dto: CommitBannerDto,
  ) {
    // Get the event to validate ownership and status
    await this.eventsService.ensureOwnership(id, user.id);

    // Validate URL matches expected pattern for this event
    // The URL should match: events/{eventId}/banner.{ext}
    // Can be absolute URL (for Spaces/CDN) or relative path (for local storage)
    let urlPath: string;
    let urlHost: string | null = null;
    let isAbsoluteUrl = false;

    try {
      const urlObj = new URL(dto.url);
      urlPath = urlObj.pathname;
      urlHost = urlObj.hostname;
      isAbsoluteUrl = true;
    } catch {
      // Relative URL (e.g., /static/events/{id}/banner.jpg) - valid for local storage
      urlPath = dto.url;
    }

    // Validate path matches pattern: events/{eventId}/banner.{ext}
    // Allow for paths like /static/events/{id}/banner.jpg or /events/{id}/banner.jpg
    const pathMatch = urlPath.match(/^\/?.*events\/([^/]+)\/banner\.\w+$/);
    if (!pathMatch || pathMatch[1] !== id) {
      throw new BadRequestException(
        `Banner URL does not match expected pattern for this event. Expected path containing 'events/${id}/banner.{ext}'`,
      );
    }

    // For absolute URLs, validate against expected storage hosts
    if (isAbsoluteUrl && urlHost) {
      const driverType = this.configService.get<string>(
        'STORAGE_DRIVER',
        'stub',
      );

      if (driverType === 'spaces') {
        // For Spaces, validate host matches CDN or Spaces endpoint
        const cdnBaseUrl = this.configService.get<string>('CDN_BASE_URL');
        const spacesEndpoint =
          this.configService.get<string>('SPACES_ENDPOINT');
        const spacesBucket = this.configService.get<string>('SPACES_BUCKET');

        const expectedHosts: string[] = [];

        if (cdnBaseUrl) {
          try {
            const cdnUrl = new URL(cdnBaseUrl);
            expectedHosts.push(cdnUrl.hostname);
          } catch {
            // Invalid CDN URL, skip
          }
        }

        if (spacesEndpoint && spacesBucket) {
          try {
            const endpointUrl = new URL(spacesEndpoint);
            // Virtual-hosted style: bucket.region.digitaloceanspaces.com
            expectedHosts.push(`${spacesBucket}.${endpointUrl.hostname}`);
          } catch {
            // Invalid endpoint, skip
          }
        }

        // If we have expected hosts, validate the URL host matches one of them
        if (expectedHosts.length > 0 && !expectedHosts.includes(urlHost)) {
          throw new BadRequestException(
            `Banner URL host does not match expected storage host. Expected one of: ${expectedHosts.join(', ')}`,
          );
        }
      }
    }

    return this.eventsService.commitBanner(id, user.id, dto.url);
  }
}
