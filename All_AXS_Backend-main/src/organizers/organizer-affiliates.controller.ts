import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../domain/enums';
import { OrganizerAffiliatesService } from './organizer-affiliates.service';
import { CreateAffiliateDto } from './dto/create-affiliate.dto';
import { UpdateAffiliateDto } from './dto/update-affiliate.dto';

@ApiTags('organizers')
@Controller('organizers/affiliates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER)
@ApiBearerAuth()
export class OrganizerAffiliatesController {
  constructor(
    private readonly affiliatesService: OrganizerAffiliatesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List affiliate / referral codes for the signed-in organizer' })
  list(@GetUser() user: CurrentUser) {
    return this.affiliatesService.listForUser(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new affiliate code' })
  create(@GetUser() user: CurrentUser, @Body() dto: CreateAffiliateDto) {
    return this.affiliatesService.createForUser(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Pause or reactivate an affiliate code' })
  @ApiParam({ name: 'id', description: 'Affiliate code ID' })
  update(
    @GetUser() user: CurrentUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAffiliateDto,
  ) {
    return this.affiliatesService.updateForUser(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove an affiliate code' })
  @ApiParam({ name: 'id', description: 'Affiliate code ID' })
  remove(
    @GetUser() user: CurrentUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.affiliatesService.deleteForUser(user.id, id);
  }
}
