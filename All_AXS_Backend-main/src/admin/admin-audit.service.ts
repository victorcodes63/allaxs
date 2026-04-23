import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAuditLog } from './entities/admin-audit-log.entity';

export interface LogActionOptions {
  adminUserId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
  status?: string;
}

@Injectable()
export class AdminAuditService {
  constructor(
    @InjectRepository(AdminAuditLog)
    private readonly adminAuditLogRepository: Repository<AdminAuditLog>,
  ) {}

  /**
   * Log an admin action to the audit log
   * This is a lightweight, non-blocking operation
   */
  async logAction(options: LogActionOptions): Promise<void> {
    const auditLog = this.adminAuditLogRepository.create({
      adminUserId: options.adminUserId,
      action: options.action,
      resourceType: options.resourceType,
      resourceId: options.resourceId ?? null,
      metadata: options.metadata,
      ipAddress: options.ipAddress ?? null,
      userAgent: options.userAgent ?? null,
      status: options.status || 'SUCCESS',
    });

    await this.adminAuditLogRepository.save(auditLog);
  }
}
