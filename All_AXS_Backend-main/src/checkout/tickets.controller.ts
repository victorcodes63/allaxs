import {
  Controller,
  Get,
  Param,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WalletPassService } from '../tickets/wallet-pass.service';
import { TicketsService } from './tickets.service';

@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly walletPassService: WalletPassService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  mine(@GetUser() user: CurrentUser) {
    return this.ticketsService.findMine(user.id, user.email);
  }

  @Get(':id/wallet/google')
  @UseGuards(JwtAuthGuard)
  googleWallet(@GetUser() user: CurrentUser, @Param('id') id: string) {
    return this.walletPassService.buildGoogleSaveUrl(user.id, id, user.email);
  }

  @Get(':id/wallet/apple')
  @UseGuards(JwtAuthGuard)
  async appleWallet(
    @GetUser() user: CurrentUser,
    @Param('id') id: string,
  ): Promise<StreamableFile> {
    const buffer = await this.walletPassService.buildApplePassBuffer(
      user.id,
      id,
      user.email,
    );
    const filename = `allaxs-${id.slice(0, 8)}.pkpass`;
    return new StreamableFile(buffer, {
      type: 'application/vnd.apple.pkpass',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  one(@GetUser() user: CurrentUser, @Param('id') id: string) {
    return this.ticketsService.findOneForOwner(user.id, id, user.email);
  }
}
