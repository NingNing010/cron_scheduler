import { SetMetadata } from '@nestjs/common';
import { DemoPermission, DemoRole } from './rbac.types';

export const ROLES_KEY = 'demo_roles';
export const PERMISSIONS_KEY = 'demo_permissions';

export const Roles = (...roles: DemoRole[]) => SetMetadata(ROLES_KEY, roles);
export const Permissions = (...permissions: DemoPermission[]) => SetMetadata(PERMISSIONS_KEY, permissions);