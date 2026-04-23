import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { ok: true, ts: new Date().toISOString(), service: 'all-axs-api' };
  }

  @Get('version')
  version() {
    return { version: '0.1.0' };
  }
}
