import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GtmWhatsappService } from './gtm-whatsapp.service';

@Injectable()
export class GtmWhatsappCronService {
  private readonly logger = new Logger(GtmWhatsappCronService.name);

  constructor(private readonly gtmWhatsappService: GtmWhatsappService) {}

  /** Every 3 minutes: fetch pending inbound messages and send AI replies via WasenderAPI. */
  @Cron('*/3 * * * *')
  async handlePendingReplies(): Promise<void> {
    try {
      const { processed } =
        await this.gtmWhatsappService.processPendingReplies();
      if (processed > 0) {
        this.logger.log(`WhatsApp AI replies sent: ${processed}`);
      }
    } catch (e) {
      this.logger.warn('WhatsApp pending-replies cron failed', e);
    }
  }
}
