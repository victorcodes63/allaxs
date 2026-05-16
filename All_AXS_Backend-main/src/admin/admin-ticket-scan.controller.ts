import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../domain/enums';
import { TicketScanService } from '../scan/ticket-scan.service';
import { ScanTicketDto } from '../scan/dto/scan-ticket.dto';
import { AdminAuditInterceptor } from './interceptors/admin-audit.interceptor';
import { AdminAction } from './decorators/admin-action.decorator';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AdminTicketScanController {
  constructor(private readonly ticketScanService: TicketScanService) {}

  @Post('tickets/scan')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(AdminAuditInterceptor)
  @AdminAction('ADMIN_TICKET_SCAN', 'system')
  @ApiOperation({
    summary: 'Verify or check in a ticket from QR payload (platform-wide)',
  })
  @ApiBody({ type: ScanTicketDto })
  @ApiResponse({ status: 200, description: 'Structured scan result (see body ok/code)' })
  async scan(@GetUser() user: CurrentUser, @Body() body: ScanTicketDto) {
    return this.ticketScanService.scanForAdmin(
      user.id,
      body.payload,
      body.action,
      body.gateId,
      body.deviceId,
    );
  }
}
