import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OrganizationTeamService } from './organization-team.service';
import { CreateOrganizationInviteDto } from './dto/create-organization-invite.dto';
import { AcceptOrganizationInviteDto } from './dto/accept-organization-invite.dto';

@Controller('organizers/team')
export class OrganizationTeamController {
  constructor(private readonly teamService: OrganizationTeamService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getTeam(@GetUser() user: CurrentUser) {
    return this.teamService.getTeamOverview(user.id);
  }

  @Post('invites')
  @UseGuards(JwtAuthGuard)
  createInvite(
    @GetUser() user: CurrentUser,
    @Body() dto: CreateOrganizationInviteDto,
  ) {
    return this.teamService.createInvite(user.id, dto);
  }

  @Delete('invites/:inviteId')
  @UseGuards(JwtAuthGuard)
  revokeInvite(
    @GetUser() user: CurrentUser,
    @Param('inviteId') inviteId: string,
  ) {
    return this.teamService.revokeInvite(user.id, inviteId);
  }

  @Delete('members/:memberId')
  @UseGuards(JwtAuthGuard)
  removeMember(
    @GetUser() user: CurrentUser,
    @Param('memberId') memberId: string,
  ) {
    return this.teamService.removeMember(user.id, memberId);
  }

  @Get('invites/preview')
  previewInvite(@Query('token') token: string) {
    return this.teamService.previewInvite(token);
  }

  @Post('invites/accept')
  @UseGuards(JwtAuthGuard)
  acceptInvite(
    @GetUser() user: CurrentUser,
    @Body() dto: AcceptOrganizationInviteDto,
  ) {
    return this.teamService.acceptInvite(user.id, dto.token);
  }
}
