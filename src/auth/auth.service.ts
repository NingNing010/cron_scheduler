import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../task/mail.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
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

  async validateGoogleUser(profile: any): Promise<any> {
    const email = profile.emails[0].value;
    const user = await this.prisma.user.findUnique({
      where: { username: email }, // In this system, username can act as email
      include: {
        role: {
          include: { permissions: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Email này chưa được cấp tài khoản hệ thống');
    }

    const { password, ...result } = user;
    return result;
  }

  async sendForgotPasswordEmail(email: string) {
    const user = await this.prisma.user.findUnique({ where: { username: email } });
    if (!user) {
      throw new UnauthorizedException('Không tìm thấy tài khoản với email này');
    }

    // Generate JWT token with secret = JWT_RESET_SECRET, payload = userId + passwordHash (prevent replay attack)
    const payload = {
      sub: user.id,
      hash: user.password.slice(-10), // Include part of the password hash to invalidate token after password change
    };

    const token = this.jwtService.sign(payload, {
      secret: process.env.JWT_RESET_SECRET || 'your_super_secret_reset_key_2026',
      expiresIn: '15m',
    });

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}?reset_token=${token}`;
    
    await this.mailService.sendCronEmail(
      email,
      'Yêu cầu khôi phục mật khẩu',
      `Bạn vừa yêu cầu khôi phục mật khẩu. Vui lòng click vào link sau để đặt lại mật khẩu mới: <a href="${resetLink}">${resetLink}</a><br>Link này sẽ hết hạn sau 15 phút. Nếu không phải bạn yêu cầu, vui lòng bỏ qua email này.`
    );

    return { message: 'Đã gửi email khôi phục mật khẩu. Vui lòng kiểm tra hộp thư.' };
  }

  async resetPassword(token: string, newPassword: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_RESET_SECRET || 'your_super_secret_reset_key_2026',
      });

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) {
        throw new UnauthorizedException('Tài khoản không tồn tại');
      }

      // Check if the hash matches to prevent replay attack
      if (payload.hash !== user.password.slice(-10)) {
        throw new UnauthorizedException('Link khôi phục đã hết hạn hoặc đã được sử dụng');
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      return { message: 'Mật khẩu đã được cập nhật thành công. Vui lòng đăng nhập lại.' };
    } catch (error) {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
  }
}
