import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RbacGuard } from './rbac.guard';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret-key',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [RbacGuard, AuthService],
  exports: [RbacGuard, JwtModule, AuthService],
})
export class AuthModule {}