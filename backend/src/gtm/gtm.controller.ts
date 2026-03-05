import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { GtmService } from './gtm.service';
import { ResolvePlaceDto } from './dto/resolve-place.dto';
import { SendOnboardingDto } from './dto/send-onboarding.dto';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { Admin } from '../auth/admin.entity';

@Controller('gtm')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class GtmController {
  constructor(private readonly gtmService: GtmService) {}

  @Get('leads')
  async getLeads(@Query('limit') limit?: string) {
    const n = limit ? Math.min(parseInt(limit, 10) || 100, 200) : 100;
    return this.gtmService.getLeads(n);
  }

  @Post('resolve-place')
  async resolvePlace(@Body() dto: ResolvePlaceDto) {
    return this.gtmService.resolvePlace(dto.mapsUrl);
  }

  @Post('find-bars-by-city')
  async findBarsByCity(@Body() body: { city: string }) {
    const city = typeof body?.city === 'string' ? body.city.trim() : '';
    if (!city) return { bars: [] };
    const bars = await this.gtmService.findBarsByCity(city);
    return { bars };
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
  async sendOnboarding(
    @Body() dto: SendOnboardingDto,
    @CurrentAdmin() admin: Admin,
  ) {
    return this.gtmService.sendOnboarding(dto, admin.id);
  }
}
