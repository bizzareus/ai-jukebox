import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { GtmWhatsappService } from './gtm-whatsapp.service';
import { GtmOnboardService } from './gtm-onboard.service';
import { OnboardCompleteDto } from './dto/onboard-complete.dto';

@Controller('gtm/onboard')
export class GtmOnboardController {
  constructor(
    private readonly gtmWhatsappService: GtmWhatsappService,
    private readonly gtmOnboardService: GtmOnboardService,
  ) {}

  @Get('context/:id')
  async getContext(@Param('id') id: string) {
    const ctx = await this.gtmWhatsappService.getOnboardContext(id);
    if (!ctx) throw new NotFoundException('Invalid or expired onboarding link');
    return ctx;
  }

  @Post('complete')
  async complete(@Body() dto: OnboardCompleteDto) {
    return this.gtmOnboardService.completeOnboard(dto);
  }
}
