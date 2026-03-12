import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { GtmWhatsappService } from './gtm-whatsapp.service';
import { VenuesService } from '../venues/venues.service';
import { AuthService } from '../auth/auth.service';
import { OnboardCompleteDto } from './dto/onboard-complete.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GtmWhatsappConversation } from './gtm-whatsapp-conversation.entity';

export interface OnboardCompleteResult {
  slug: string;
  qrCodeUrl: string;
  loginLink: string;
  venueId: string;
}

@Injectable()
export class GtmOnboardService {
  private readonly logger = new Logger(GtmOnboardService.name);

  constructor(
    private readonly gtmWhatsappService: GtmWhatsappService,
    private readonly venuesService: VenuesService,
    private readonly authService: AuthService,
    @InjectRepository(GtmWhatsappConversation)
    private readonly conversationRepo: Repository<GtmWhatsappConversation>,
  ) {}

  async completeOnboard(dto: OnboardCompleteDto): Promise<OnboardCompleteResult> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: dto.conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('Invalid onboarding link');
    }
    if (conversation.onboardedVenueId) {
      throw new BadRequestException(
        'This link was already used. Please log in to your venue admin.',
      );
    }
    const ownerId =
      conversation.createdByAdminId ??
      (await this.authService.findFirstSuperAdminId());
    if (!ownerId) {
      throw new BadRequestException(
        'No super admin configured. Please contact support.',
      );
    }
    const venue = await this.venuesService.createFromOnboard(
      dto.venueName.trim(),
      ownerId,
      dto.pricePerSong,
    );
    const admin = await this.authService.createVenueAdmin(
      venue.id,
      dto.email,
      dto.password,
      dto.name.trim(),
    );
    await this.gtmWhatsappService.setOnboardedVenue(conversation.id, venue.id);
    const { loginLink } = await this.authService.createLoginLink(admin.id);
    this.logger.log(
      `Onboard complete: ${dto.venueName} [${venue.slug}] admin=${admin.email}`,
    );
    return {
      slug: venue.slug,
      qrCodeUrl: venue.qrCodeUrl ?? '',
      loginLink,
      venueId: venue.id,
    };
  }
}
