import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { TestService } from './test.service';
import type { SeedUserDto } from './test.service';
import { AdminAuditLog } from '../admin/entities/admin-audit-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Controller('__test__')
export class TestController {
  constructor(
    private readonly testService: TestService,
    @InjectRepository(AdminAuditLog)
    private readonly adminAuditLogRepository: Repository<AdminAuditLog>,
  ) {
    // Guard: Only allow in test environment
    if (
      process.env.NODE_ENV !== 'test' &&
      process.env.ENABLE_TEST_ROUTES !== 'true'
    ) {
      throw new ForbiddenException(
        'Test routes are only available in test environment',
      );
    }
  }

  @Post('seed-user')
  async seedUser(@Body() dto: SeedUserDto) {
    const user = await this.testService.seedUser(dto);
    return {
      message: 'User seeded successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles,
      },
    };
  }

  @Get('latest-tokens')
  async getLatestTokens(@Query('email') email: string) {
    if (!email) {
      return { resetToken: null, verifyToken: null };
    }
    return this.testService.getLatestTokens(email);
  }

  @Get('audit-latest')
  async getLatestAuditLog() {
    const latest = await this.adminAuditLogRepository.findOne({
      order: { createdAt: 'DESC' },
      relations: ['adminUser'],
    });

    if (!latest) {
      return { message: 'No audit logs found' };
    }

    return {
      id: latest.id,
      adminUserId: latest.adminUserId,
      action: latest.action,
      resourceType: latest.resourceType,
      resourceId: latest.resourceId,
      metadata: latest.metadata,
      status: latest.status,
      createdAt: latest.createdAt,
    };
  }
}
