import { Controller, Post, Body, UnauthorizedException, Get, Headers } from '@nestjs/common';
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
}
