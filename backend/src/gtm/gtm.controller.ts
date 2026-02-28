import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { GtmService } from './gtm.service';
import { ResolvePlaceDto } from './dto/resolve-place.dto';
import { SendOnboardingDto } from './dto/send-onboarding.dto';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('gtm')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class GtmController {
  constructor(private readonly gtmService: GtmService) {}

  @Post('resolve-place')
  async resolvePlace(@Body() dto: ResolvePlaceDto) {
    return this.gtmService.resolvePlace(dto.mapsUrl);
  }

  @Post('find-email')
  async findEmail(@Body() body: { websiteUrl: string }) {
    if (!body?.websiteUrl || typeof body.websiteUrl !== 'string') {
      return { email: null };
    }
    const email = await this.gtmService.findEmailFromWebsite(body.websiteUrl);
    return { email };
  }

  @Post('send-onboarding')
  async sendOnboarding(@Body() dto: SendOnboardingDto) {
    return this.gtmService.sendOnboarding(dto);
  }
}
