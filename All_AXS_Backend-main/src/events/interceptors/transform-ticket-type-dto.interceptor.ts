import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Transform empty strings to undefined for optional fields in ticket type DTOs
 * This prevents validation errors when empty strings are sent for optional fields
 * Runs BEFORE ValidationPipe, so empty strings are converted to undefined
 */
@Injectable()
export class TransformTicketTypeDtoInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();

    const body = request.body;

    if (body && typeof body === 'object' && body !== null) {
      const typedBody = body;
      // Transform empty strings to undefined for optional fields

      if (typedBody.description === '' || typedBody.description === null) {
        typedBody.description = undefined;
      }

      if (typedBody.salesStartAt === '' || typedBody.salesStartAt === null) {
        typedBody.salesStartAt = undefined;
      }

      if (typedBody.salesEndAt === '' || typedBody.salesEndAt === null) {
        typedBody.salesEndAt = undefined;
      }

      if (
        typedBody.maxPerOrder === '' ||
        typedBody.maxPerOrder === null ||
        typedBody.maxPerOrder === 'undefined'
      ) {
        typedBody.maxPerOrder = undefined;
      }
    }

    return next.handle();
  }
}
