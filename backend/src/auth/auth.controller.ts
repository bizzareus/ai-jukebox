import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { Admin } from './admin.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentAdmin() admin: Admin) {
    return this.authService.me(admin.id);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(@CurrentAdmin() admin: Admin, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(admin.id, dto);
  }

  @Post('login-link')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  createLoginLink(@Body() body: { adminId: string }) {
    if (!body?.adminId || typeof body.adminId !== 'string') {
      throw new BadRequestException('adminId required');
    }
    return this.authService.createLoginLink(body.adminId);
  }

  @Post('login-with-token')
  loginWithToken(@Body() body: { token: string }) {
    if (!body?.token || typeof body.token !== 'string') {
      throw new BadRequestException('token required');
    }
    return this.authService.loginWithToken(body.token);
  }
}
