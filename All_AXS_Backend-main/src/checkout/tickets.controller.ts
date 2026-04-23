import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TicketsService } from './tickets.service';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  mine(@GetUser() user: CurrentUser) {
    return this.ticketsService.findMine(user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  one(@GetUser() user: CurrentUser, @Param('id') id: string) {
    return this.ticketsService.findOneForOwner(user.id, id);
  }
}
