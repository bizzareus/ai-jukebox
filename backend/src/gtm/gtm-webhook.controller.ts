import { Body, Controller, Post } from '@nestjs/common';
import { GtmWhatsappService } from './gtm-whatsapp.service';
import type { WasenderWebhookPayload } from './gtm-whatsapp.service';

@Controller('gtm')
export class GtmWebhookController {
  constructor(private readonly gtmWhatsappService: GtmWhatsappService) {}

  /** WasenderAPI sends incoming WhatsApp messages here. No auth (webhook). */
  @Post('webhooks/whatsapp')
  async whatsappWebhook(
    @Body() payload: WasenderWebhookPayload,
  ): Promise<{ ok: boolean }> {
    await this.gtmWhatsappService.handleWebhook(payload);
    return { ok: true };
  }
}
