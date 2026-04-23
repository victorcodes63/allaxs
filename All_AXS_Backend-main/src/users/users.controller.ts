import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../domain/enums';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  async getProfile(@GetUser() user: CurrentUser) {
    return this.usersService.findById(user.id);
  }

  @Get('admin/stats')
  @Roles(Role.ADMIN)
  getAdminStats(@GetUser() user: CurrentUser) {
    return {
      message: 'This is an admin-only endpoint',
      requestedBy: user.email,
      roles: user.roles,
    };
  }
}
