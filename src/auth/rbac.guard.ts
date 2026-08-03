import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PERMISSIONS_KEY, ROLES_KEY } from './rbac.decorator';
import { DemoPermission, DemoRole } from './rbac.types';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<DemoRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]) ?? [];
    const requiredPermissions = this.reflector.getAllAndOverride<DemoPermission[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) ?? [];

    if (!requiredRoles.length && !requiredPermissions.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Không tìm thấy token xác thực');
    }

    const token = authHeader.split(' ')[1];
    let payload: any;
    
    try {
      payload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET || 'super-secret-key' });
      request.user = payload; // Attach user to request
    } catch (e) {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }

    const userRoles = new Set<string>(payload.roles || []);
    const userPermissions = new Set<string>(payload.permissions || []);

    const hasRole = !requiredRoles.length || requiredRoles.some((role) => userRoles.has(role));
    const hasPermissions = !requiredPermissions.length || userPermissions.has('manage:all') || requiredPermissions.every((permission) => userPermissions.has(permission));

    if (!hasRole || !hasPermissions) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }

    return true;
  }
}