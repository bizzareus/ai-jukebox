import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SetAdminPasswordDto } from './dto/set-admin-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';

@Controller('admins')
export class AdminsController {
  constructor(private readonly authService: AuthService) {}

  @Patch(':id/password')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  setPassword(@Param('id') adminId: string, @Body() dto: SetAdminPasswordDto) {
    return this.authService.setAdminPassword(adminId, dto.newPassword);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  deleteVenueAdmin(@Param('id') adminId: string) {
    return this.authService.deleteVenueAdmin(adminId);
  }
}
