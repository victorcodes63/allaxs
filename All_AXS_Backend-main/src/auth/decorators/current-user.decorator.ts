import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '../../domain/enums';

export interface CurrentUser {
  id: string;
  email: string;
  name?: string;
  roles: Role[];
}

export const GetUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUser => {
    const request = ctx.switchToHttp().getRequest<{ user: CurrentUser }>();
    return request.user;
  },
);
