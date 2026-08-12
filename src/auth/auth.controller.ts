import { Controller, Post, Body, UnauthorizedException, Get, Headers, UseGuards, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: any) {
    if (!body.username || !body.password) {
      throw new UnauthorizedException('Username and password are required');
    }
    
    const user = await this.authService.validateUser(body.username, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @Post('register')
  async register(@Body() body: any) {
    if (!body.username || !body.password) {
      throw new UnauthorizedException('Username and password are required');
    }
    return this.authService.register(body.username, body.password);
  }

  @Post('seed')
  async seedRolesAndAdmin(@Body('secret') secretBody: string, @Headers('x-secret-key') secretHeader: string) {
    const secret = secretBody || secretHeader;
    return this.authService.seedRolesAndAdmin(secret);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req: any) {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: any, @Res() res: any) {
    const tokenData = await this.authService.login(req.user);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}?token=${tokenData.access_token}`);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: any) {
    if (!body.email) {
      throw new UnauthorizedException('Email is required');
    }
    return this.authService.sendForgotPasswordEmail(body.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: any) {
    if (!body.token || !body.newPassword) {
      throw new UnauthorizedException('Token and new password are required');
    }
    return this.authService.resetPassword(body.token, body.newPassword);
  }
}
