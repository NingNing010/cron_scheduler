import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        role: {
          include: { permissions: true },
        },
      },
    });

    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    // Extract role name and permissions
    const roles = user.role ? [user.role.name] : [];
    const permissions = user.role?.permissions.map((p: any) => p.name) || [];

    const payload = {
      username: user.username,
      sub: user.id,
      roles,
      permissions,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        roles,
        permissions,
      }
    };
  }

  async register(username: string, pass: string) {
    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing) throw new UnauthorizedException('Username already exists');

    let employeeRole = await this.prisma.role.findUnique({ where: { name: 'employee' } });
    if (!employeeRole) {
      throw new UnauthorizedException('Employee role not found. Please run seed first.');
    }

    const hashedPassword = await bcrypt.hash(pass, 10);
    const user = await this.prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        roleId: employeeRole.id,
      },
    });

    return { message: 'User registered successfully', userId: user.id };
  }

  async seedRolesAndAdmin(secretKey: string) {
    if (secretKey !== (process.env.SEED_SECRET || 'cron-secret-123')) {
      throw new UnauthorizedException('Invalid secret key for seeding');
    }

    const rolesData = [
      { name: 'admin', permissions: ['manage:all'] },
      { name: 'manager', permissions: ['employee:read', 'employee:create', 'employee:update', 'task:read', 'task:create'] },
      { name: 'employee', permissions: ['employee:read', 'task:read'] }
    ];

    for (const r of rolesData) {
      await this.prisma.role.upsert({
        where: { name: r.name },
        create: {
          name: r.name,
          permissions: {
            connectOrCreate: r.permissions.map((p: any) => ({
              where: { name: p },
              create: { name: p }
            }))
          }
        },
        update: {
          permissions: {
            connectOrCreate: r.permissions.map((p: any) => ({
              where: { name: p },
              create: { name: p }
            }))
          }
        }
      });
    }

    const adminRole = await this.prisma.role.findUnique({ where: { name: 'admin' } });
    const adminUser = await this.prisma.user.findUnique({ where: { username: 'admin' } });
    
    if (!adminUser && adminRole) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      await this.prisma.user.create({
        data: {
          username: 'admin',
          password: hashedPassword,
          fullName: 'System Administrator',
          roleId: adminRole.id,
        }
      });
      return { message: 'Roles seeded and Admin user created (admin / password123)' };
    }
    
    return { message: 'Roles and permissions verified/seeded successfully' };
  }
}
