import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { GtmLead } from './gtm-lead.entity';
import { SendOnboardingDto } from './dto/send-onboarding.dto';

export interface ResolvedPlace {
  placeId: string;
  name: string;
  address?: string;
  phone?: string;
  website?: string;
}

@Injectable()
export class GtmService {
  private readonly logger = new Logger(GtmService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(GtmLead)
    private readonly gtmLeadRepository: Repository<GtmLead>,
  ) {}

  /** Extract place name and optional lat,lng from a Google Maps URL. */
  private parseMapsUrl(mapsUrl: string): {
    placeName: string;
    lat?: number;
    lng?: number;
  } {
    try {
      const url = new URL(mapsUrl);
      const path = url.pathname || '';
      const placeMatch = path.match(/\/place\/([^/]+)/);
      const placeName = placeMatch
        ? decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
        : url.searchParams.get('q') || mapsUrl;

      const coordMatch = path.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      let lat: number | undefined;
      let lng: number | undefined;
      if (coordMatch) {
        lat = parseFloat(coordMatch[1]);
        lng = parseFloat(coordMatch[2]);
      }
      return { placeName: placeName.trim() || 'Place', lat, lng };
    } catch {
      return { placeName: mapsUrl };
    }
  }

  async resolvePlace(mapsUrl: string): Promise<ResolvedPlace | null> {
    const apiKey = this.configService.get<string>('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      this.logger.warn('GOOGLE_PLACES_API_KEY not set');
      return null;
    }
    const { placeName, lat, lng } = this.parseMapsUrl(mapsUrl);

    try {
      // Places API (New): searchText (replaces legacy findplacefromtext + textsearch)
      const searchBody: {
        textQuery: string;
        locationBias?: {
          circle: {
            center: { latitude: number; longitude: number };
            radius: number;
          };
        };
        pageSize?: number;
      } = { textQuery: placeName, pageSize: 1 };
      if (lat != null && lng != null) {
        searchBody.locationBias = {
          circle: { center: { latitude: lat, longitude: lng }, radius: 2000 },
        };
      }
      const searchRes = await axios.post<{
        places?: Array<{
          id?: string;
          displayName?: { text?: string };
          formattedAddress?: string;
          nationalPhoneNumber?: string;
          websiteUri?: string;
        }>;
      }>('https://places.googleapis.com/v1/places:searchText', searchBody, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri',
        },
      });
      const first = searchRes.data?.places?.[0];
      const placeId = first?.id;
      if (!placeId) {
        this.logger.warn(`No place found for: ${placeName}`);
        return null;
      }

      // If search already returned details, use them; otherwise fetch Place Details (New)
      const name = first.displayName?.text ?? placeName;
      let address = first.formattedAddress;
      let phone = first.nationalPhoneNumber;
      let website = first.websiteUri;
      if (
        address === undefined ||
        phone === undefined ||
        website === undefined
      ) {
        const detailsRes = await axios.get<{
          displayName?: { text?: string };
          formattedAddress?: string;
          nationalPhoneNumber?: string;
          websiteUri?: string;
        }>(`https://places.googleapis.com/v1/places/${placeId}`, {
          timeout: 10000,
          headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask':
              'displayName,formattedAddress,nationalPhoneNumber,websiteUri',
          },
        });
        const d = detailsRes.data;
        if (d) {
          if (address === undefined) address = d.formattedAddress;
          if (phone === undefined) phone = d.nationalPhoneNumber;
          if (website === undefined) website = d.websiteUri;
        }
      }

      return {
        placeId,
        name,
        address,
        phone,
        website,
      };
    } catch (e) {
      this.logger.warn('Places API error', e);
      return null;
    }
  }

  async findEmailFromWebsite(websiteUrl: string): Promise<string | null> {
    try {
      const res = await axios.get<string>(websiteUrl, {
        timeout: 8000,
        responseType: 'text',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Jukebox GTM)' },
        maxContentLength: 500000,
      });
      const html = res.data || '';
      const mailtoMatch = html.match(
        /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
      );
      if (mailtoMatch) return mailtoMatch[1].trim();
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emails = html.match(emailRegex) || [];
      const filtered = emails.filter(
        (e) =>
          !/^(noreply|no-reply|support@|admin@|donotreply|image|email|example|test@)/i.test(
            e,
          ) &&
          !e.endsWith('.png') &&
          !e.endsWith('.jpg'),
      );
      return filtered[0]?.trim() ?? null;
    } catch (e) {
      this.logger.warn('Find email from website failed', e);
      return null;
    }
  }

  async sendOnboarding(
    dto: SendOnboardingDto,
  ): Promise<{ ok: boolean; error?: string }> {
    const fromEmail =
      this.configService.get<string>('GTM_FROM_EMAIL') ||
      this.configService.get<string>('RESEND_FROM') ||
      'Jukebox <kartik@muzobox.com>';
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const signupUrl =
      this.configService.get<string>('FRONTEND_URL') || 'https://muzobox.com';
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Music Jukebox for your venue</title></head>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#333;">
  <h1 style="color:#E11D48;">Turn your venue into a jukebox</h1>
  <p>Hi,</p>
  <p>We’re <strong>Jukebox</strong> — a simple way to let your customers request and pay for songs at your bar or venue.</p>
  <p>During non-DJ hours, your customers can play music on their own: they scan a QR code, pick a song, and pay (e.g. UPI). <strong>You earn from every song they play.</strong></p>
  <ul>
    <li>Guests scan a QR code, pick a song, and pay.</li>
    <li>You control the queue and what’s playing from one dashboard.</li>
    <li>No hardware: use your existing speakers and phone.</li>
  </ul>
  <p>Sign up and start earning from your customers. Perfect for bars, cafes, and parties.</p>
  <p><a href="${signupUrl}/admin/login" style="display:inline-block;background:#E11D48;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;">Get started — sign up here</a></p>
  <p>If you have questions, reply to this email or call us at <a href="tel:+919999224767">+91 9999224767</a> to know more. We’re happy to help.</p>
  <p>Cheers,<br/>The Jukebox team</p>
</body>
</html>
`;
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not set — storing lead only');
      await this.saveLead(dto, 'skipped_no_provider');
      return { ok: false, error: 'Email provider not configured' };
    }
    const replyTo = this.configService.get<string>('GTM_REPLY_TO');
    const payload: Record<string, unknown> = {
      from: fromEmail,
      to: [dto.email],
      subject: `Free Jukebox App for ${dto.placeName}`,
      html,
    };
    if (replyTo) payload.reply_to = replyTo;
    try {
      await axios.post('https://api.resend.com/emails', payload, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
      await this.saveLead(dto, 'sent');
      this.logger.log(
        `Onboarding email sent to ${dto.email} for ${dto.placeName}`,
      );
      return { ok: true };
    } catch (e) {
      const message = axios.isAxiosError(e)
        ? e.response?.data?.message
        : (e as Error).message;
      this.logger.warn('Send onboarding failed', e);
      await this.saveLead(dto, 'failed');
      return { ok: false, error: message ?? 'Failed to send email' };
    }
  }

  private async saveLead(
    dto: SendOnboardingDto,
    status: string,
  ): Promise<void> {
    await this.gtmLeadRepository.save(
      this.gtmLeadRepository.create({
        placeId: dto.placeId,
        placeName: dto.placeName,
        address: dto.address,
        phone: dto.phone,
        website: dto.website,
        email: dto.email,
        status,
        sentAt: new Date(),
      }),
    );
  }
}
