import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { GtmLead } from './gtm-lead.entity';
import { GtmWhatsappConversation } from './gtm-whatsapp-conversation.entity';
import { GtmWhatsappMessage } from './gtm-whatsapp-message.entity';
import { GtmService } from './gtm.service';
import { GtmController } from './gtm.controller';
import { GtmWebhookController } from './gtm-webhook.controller';
import { GtmOnboardController } from './gtm-onboard.controller';
import { GtmOnboardService } from './gtm-onboard.service';
import { InviteTokenService } from './invite-token.service';
import { WasenderApiService } from './wasender-api.service';
import { GtmWhatsappService } from './gtm-whatsapp.service';
import { GtmWhatsappCronService } from './gtm-whatsapp-cron.service';
import { AuthModule } from '../auth/auth.module';
import { VenuesModule } from '../venues/venues.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GtmLead,
      GtmWhatsappConversation,
      GtmWhatsappMessage,
    ]),
    ConfigModule,
    forwardRef(() => AuthModule),
    forwardRef(() => VenuesModule),
  ],
  controllers: [GtmController, GtmWebhookController, GtmOnboardController],
  providers: [
    GtmService,
    InviteTokenService,
    WasenderApiService,
    GtmWhatsappService,
    GtmWhatsappCronService,
    GtmOnboardService,
  ],
  exports: [GtmService, InviteTokenService, GtmWhatsappService],
})
export class GtmModule {}
