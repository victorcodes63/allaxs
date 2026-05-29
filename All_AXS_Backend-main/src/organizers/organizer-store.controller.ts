import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../domain/enums';
import { OrganizerStoreService } from './organizer-store.service';
import { UpdateOrganizerStoreDto } from './dto/update-organizer-store.dto';

@ApiTags('organizers')
@Controller('organizers/store')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER)
@ApiBearerAuth()
export class OrganizerStoreController {
  constructor(private readonly storeService: OrganizerStoreService) {}

  @Get()
  @ApiOperation({ summary: 'Get branded public store settings for the signed-in organizer' })
  getStore(@GetUser() user: CurrentUser) {
    return this.storeService.getForUser(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update branded public store settings' })
  updateStore(
    @GetUser() user: CurrentUser,
    @Body() dto: UpdateOrganizerStoreDto,
  ) {
    return this.storeService.updateForUser(user.id, dto);
  }
}
