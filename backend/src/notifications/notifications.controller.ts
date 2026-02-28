import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { Admin } from '../auth/admin.entity';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('vapid-public-key')
  getVapidPublicKey(): { publicKey: string | null } {
    return { publicKey: this.notificationsService.getVapidPublicKey() };
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  subscribe(
    @Body() dto: SubscribePushDto,
    @CurrentAdmin() admin: Admin,
  ) {
    if (dto.venueId && admin.venueId !== dto.venueId && admin.role !== 'super_admin') {
      dto.venueId = admin.venueId;
    }
    return this.notificationsService.subscribe(dto);
  }

  @Post('subscribe-customer')
  subscribeCustomer(@Body() dto: SubscribePushDto) {
    if (!dto.orderId) return { ok: false };
    return this.notificationsService.subscribe(dto);
  }
}
