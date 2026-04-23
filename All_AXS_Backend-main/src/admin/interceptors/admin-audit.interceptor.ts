import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  ADMIN_ACTION_KEY,
  AdminActionMetadata,
} from '../decorators/admin-action.decorator';
import { AdminAuditService } from '../admin-audit.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly adminAuditService: AdminAuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const metadata = this.reflector.get<AdminActionMetadata>(
      ADMIN_ACTION_KEY,
      context.getHandler(),
    );

    // If no @AdminAction decorator, just pass through
    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      user?: CurrentUser;
      params?: Record<string, string>;
      ip?: string;
      headers?: Record<string, string>;
    }>();

    const user = request.user;
    if (!user) {
      return next.handle();
    }

    // Extract resource ID from route params
    const resourceId =
      metadata.resourceIdParam && request.params
        ? request.params[metadata.resourceIdParam]
        : undefined;

    // Extract IP address and user agent
    const ipAddress =
      request.ip ||
      request.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.headers?.['x-real-ip'] ||
      null;

    const userAgent = request.headers?.['user-agent'] || null;

    return next.handle().pipe(
      tap({
        next: () => {
          // Log successful action
          void this.adminAuditService
            .logAction({
              adminUserId: user.id,
              action: metadata.action,
              resourceType: metadata.resourceType,
              resourceId,
              ipAddress,
              userAgent,
              status: 'SUCCESS',
            })
            .catch((error) => {
              // Don't fail the request if audit logging fails
              console.error('Failed to log admin action:', error);
            });
        },
        error: (error: Error) => {
          // Log failed action
          void this.adminAuditService
            .logAction({
              adminUserId: user.id,
              action: metadata.action,
              resourceType: metadata.resourceType,
              resourceId,
              metadata: {
                error: error.message,
              },
              ipAddress,
              userAgent,
              status: 'FAILURE',
            })
            .catch((auditError) => {
              // Don't fail the request if audit logging fails
              console.error('Failed to log admin action failure:', auditError);
            });
        },
      }),
    );
  }
}
