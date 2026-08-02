import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, ROLES_KEY } from './rbac.decorator';
import { DemoPermission, DemoRole } from './rbac.types';

const parseHeaderList = (value: unknown): string[] => {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<DemoRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]) ?? [];
    const requiredPermissions = this.reflector.getAllAndOverride<DemoPermission[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) ?? [];

    if (!requiredRoles.length && !requiredPermissions.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const headerRoles = parseHeaderList(request.headers['x-roles'] ?? request.headers['x-role']);
    const headerPermissions = parseHeaderList(request.headers['x-permissions'] ?? request.headers['x-permission']);

    const userRoles = new Set<string>(headerRoles);
    const userPermissions = new Set<string>(headerPermissions);

    const hasRole = !requiredRoles.length || requiredRoles.some((role) => userRoles.has(role));
    const hasPermissions = !requiredPermissions.length || requiredPermissions.every((permission) => userPermissions.has(permission));

    if (!hasRole || !hasPermissions) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }

    return true;
  }
}