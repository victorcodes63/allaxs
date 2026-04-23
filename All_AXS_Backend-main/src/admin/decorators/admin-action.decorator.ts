import { SetMetadata } from '@nestjs/common';

export const ADMIN_ACTION_KEY = 'adminAction';

export interface AdminActionMetadata {
  action: string;
  resourceType: string;
  resourceIdParam?: string; // Route parameter name for resource ID (e.g., 'id', 'eventId')
}

export const AdminAction = (
  action: string,
  resourceType: string,
  resourceIdParam: string = 'id',
) =>
  SetMetadata(ADMIN_ACTION_KEY, {
    action,
    resourceType,
    resourceIdParam,
  } as AdminActionMetadata);
