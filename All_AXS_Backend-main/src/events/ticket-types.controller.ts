import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../domain/enums';
import { TicketTypesService } from './ticket-types.service';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
import { TicketType } from './entities/ticket-type.entity';
import { TransformTicketTypeDtoInterceptor } from './interceptors/transform-ticket-type-dto.interceptor';

@ApiTags('ticket-types')
@Controller()
export class TicketTypesController {
  private readonly logger = new Logger(TicketTypesController.name);

  constructor(private readonly ticketTypesService: TicketTypesService) {}

  @Post('events/:eventId/ticket-types')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(TransformTicketTypeDtoInterceptor)
  @Roles(Role.ORGANIZER)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a ticket type for an event' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiResponse({
    status: 201,
    description: 'Ticket type created',
    type: TicketType,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 409, description: 'Duplicate ticket type name' })
  async create(
    @Param('eventId') eventId: string,
    @GetUser() user: CurrentUser,
    @Body() dto: CreateTicketTypeDto,
  ) {
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(
        `POST /events/${eventId}/ticket-types - User: ${user.id}, Roles: ${user.roles?.join(',')}`,
      );
      this.logger.debug(`DTO: ${JSON.stringify(dto)}`);
    }

    try {
      return await this.ticketTypesService.create(
        eventId,
        user.id,
        user.roles,
        dto,
      );
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          `Error creating ticket type: ${errorMessage}`,
          errorStack,
        );
      }
      throw error;
    }
  }

  @Get('events/:eventId/ticket-types')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get all ticket types for an event' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiResponse({
    status: 200,
    description: 'Ticket types list',
    type: [TicketType],
  })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findByEvent(
    @Param('eventId') eventId: string,
    @GetUser() user?: CurrentUser,
  ) {
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(
        `GET /events/${eventId}/ticket-types - User: ${user?.id || 'anonymous'}`,
      );
    }

    try {
      return await this.ticketTypesService.findByEvent(
        eventId,
        user?.id,
        user?.roles,
      );
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          `Error fetching ticket types: ${errorMessage}`,
          errorStack,
        );
      }
      throw error;
    }
  }

  @Get('ticket-types/:id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get a ticket type by ID' })
  @ApiParam({ name: 'id', description: 'Ticket type ID' })
  @ApiResponse({
    status: 200,
    description: 'Ticket type found',
    type: TicketType,
  })
  @ApiResponse({ status: 404, description: 'Ticket type not found' })
  async findOne(@Param('id') id: string, @GetUser() user?: CurrentUser) {
    return this.ticketTypesService.findOne(id, user?.id, user?.roles);
  }

  @Patch('ticket-types/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(TransformTicketTypeDtoInterceptor)
  @Roles(Role.ORGANIZER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a ticket type' })
  @ApiParam({ name: 'id', description: 'Ticket type ID' })
  @ApiResponse({
    status: 200,
    description: 'Ticket type updated',
    type: TicketType,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket type not found' })
  @ApiResponse({ status: 409, description: 'Duplicate ticket type name' })
  async update(
    @Param('id') id: string,
    @GetUser() user: CurrentUser,
    @Body() dto: UpdateTicketTypeDto,
  ) {
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(
        `PATCH /ticket-types/${id} - User: ${user.id}, Roles: ${user.roles?.join(',')}`,
      );
      this.logger.debug(`DTO: ${JSON.stringify(dto)}`);
    }

    try {
      return await this.ticketTypesService.update(id, user.id, user.roles, dto);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          `Error updating ticket type: ${errorMessage}`,
          errorStack,
        );
      }
      throw error;
    }
  }

  @Delete('ticket-types/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a ticket type' })
  @ApiParam({ name: 'id', description: 'Ticket type ID' })
  @ApiResponse({ status: 204, description: 'Ticket type deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket type not found' })
  async remove(@Param('id') id: string, @GetUser() user: CurrentUser) {
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(
        `DELETE /ticket-types/${id} - User: ${user.id}, Roles: ${user.roles?.join(',')}`,
      );
    }

    try {
      await this.ticketTypesService.remove(id, user.id, user.roles);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          `Error deleting ticket type: ${errorMessage}`,
          errorStack,
        );
      }
      throw error;
    }
  }
}
