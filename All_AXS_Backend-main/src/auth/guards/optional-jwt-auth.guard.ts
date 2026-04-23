import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Override handleRequest to not throw error on authentication failure
  // This allows routes to work for both authenticated and unauthenticated users
  handleRequest<TUser = any>(
    err: any,
    user: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _info: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: ExecutionContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _status?: any,
  ): TUser {
    // If there's an error or no user, return undefined (don't throw)
    // The route handler can check if user exists to determine if authenticated
    if (err) {
      // Error occurred (e.g., invalid token) - allow request but return undefined user
      return undefined as TUser;
    }
    // Return user if authenticated, undefined if not
    return (user || undefined) as TUser;
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Always allow the request through - authentication is optional
    // If token is present and valid, user will be set
    // If token is missing or invalid, user will be undefined
    const result = super.canActivate(context);

    if (result instanceof Promise) {
      return result.catch(() => {
        // If authentication fails, still allow request (user will be undefined)
        return true;
      });
    }

    if (result instanceof Observable) {
      return result.pipe(
        catchError(() => {
          // If authentication fails, still allow request (user will be undefined)
          return of(true);
        }),
      );
    }

    return result || true;
  }
}
