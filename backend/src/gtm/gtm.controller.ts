import {
  Body,
  Controller,
  Get,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GtmService } from './gtm.service';
import { GtmWhatsappService } from './gtm-whatsapp.service';
import { ResolvePlaceDto } from './dto/resolve-place.dto';
import { SendOnboardingDto } from './dto/send-onboarding.dto';
import { FindBarsByLocationDto } from './dto/find-bars-by-location.dto';
import { OnboardingMessageDto } from './dto/onboarding-message.dto';
import { SendWhatsappDto } from './dto/send-whatsapp.dto';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { Admin } from '../auth/admin.entity';

@Controller('gtm')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class GtmController {
  private readonly logger = new Logger(GtmController.name);

  constructor(
    private readonly gtmService: GtmService,
    private readonly gtmWhatsappService: GtmWhatsappService,
  ) {}

  @Get('leads')
  async getLeads(@Query('limit') limit?: string) {
    const n = limit ? Math.min(parseInt(limit, 10) || 100, 200) : 100;
    try {
      return await this.gtmService.getLeads(n);
    } catch (err) {
      this.logger.warn('getLeads failed', err);
      const message =
        err instanceof Error ? err.message : 'Unknown error loading GTM leads';
      throw new InternalServerErrorException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Failed to load GTM leads',
        message:
          message.includes('does not exist') || message.includes('relation')
            ? 'GTM leads table missing or schema outdated. Run backend/scripts/add-gtm-leads.sql and add-gtm-leads-linkedin-message.sql.'
            : message,
      });
    }
  }

  @Post('resolve-place')
  async resolvePlace(@Body() dto: ResolvePlaceDto) {
    return this.gtmService.resolvePlace(dto.mapsUrl);
  }

  @Post('find-bars-by-location')
  async findBarsByLocation(@Body() dto: FindBarsByLocationDto) {
    const bars = await this.gtmService.findBarsByLocation(dto.lat, dto.lng);
    return { bars };
  }

  @Post('onboarding-message')
  getOnboardingMessage(
    @Body() dto: OnboardingMessageDto,
    @CurrentAdmin() admin: Admin,
  ) {
    return this.gtmService.getOnboardingMessage(
      dto.placeName,
      {
        address: dto.address,
        placeId: dto.placeId,
        email: dto.email,
        contactName: dto.contactName,
      },
      admin.id,
    );
  }

  @Post('find-mobile')
  async findMobile(@Body() body: { venueName: string; address?: string }) {
    if (!body?.venueName || typeof body.venueName !== 'string') {
      return { mobile: null, contactName: null };
    }
    return this.gtmService.findMobileWithOpenAI(
      body.venueName.trim(),
      typeof body.address === 'string' ? body.address.trim() : undefined,
    );
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

  @Post('whatsapp/send')
  async sendWhatsapp(
    @Body() dto: SendWhatsappDto,
    @CurrentAdmin() admin: Admin,
  ) {
    return this.gtmWhatsappService.sendToBars({
      bars: dto.bars.map((b) => ({ phone: b.phone, barName: b.barName })),
      message: dto.message,
      adminId: admin.id,
    });
  }

  @Get('whatsapp/conversations')
  async getWhatsappConversations(@Query('limit') limit?: string) {
    const n = limit ? Math.min(parseInt(limit, 10) || 50, 200) : 50;
    return this.gtmWhatsappService.getConversations(n);
  }

  @Get('whatsapp/conversations/:id/messages')
  async getWhatsappMessages(@Param('id') id: string) {
    return this.gtmWhatsappService.getMessages(id);
  }
}
