import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from 'src/auth/decorators/public.decorator';
import { ScannerSessionGuard } from './guards/scanner-session.guard';
import type { ScannerRequest } from './guards/scanner-session.guard';
import { ScanService } from './scan.service';
import { ValidateQrDto } from './dto/validate-qr.dto';

@ApiTags('scanner')
@Controller('scan')
@Public()
export class ScanController {
  constructor(private readonly scanService: ScanService) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ScannerSessionGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Validate a QR code at the door (scanner token required)' })
  @ApiHeader({ name: 'X-Scanner-Token', description: 'Scanner session token', required: true })
  @ApiResponse({ status: 200, description: 'Validation result — never includes PII' })
  @ApiResponse({ status: 401, description: 'Invalid or expired scanner session' })
  async validate(
    @Body() dto: ValidateQrDto,
    @Req() req: ScannerRequest,
  ) {
    return this.scanService.validate(
      dto.qrPayload,
      req.scannerSession.sessionId,
      req.scannerSession.eventId,
    );
  }

  @Get('session-info')
  @UseGuards(ScannerSessionGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get scanner session info (label + event title) — no attendee data' })
  @ApiHeader({ name: 'X-Scanner-Token', description: 'Scanner session token', required: true })
  @ApiResponse({ status: 200, description: 'Session info' })
  @ApiResponse({ status: 401, description: 'Invalid or expired scanner session' })
  async sessionInfo(@Req() req: ScannerRequest) {
    return this.scanService.getSessionInfo(req.scannerSession.sessionId);
  }
}
