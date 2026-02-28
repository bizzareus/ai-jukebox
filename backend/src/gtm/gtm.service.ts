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
  private parseMapsUrl(mapsUrl: string): { placeName: string; lat?: number; lng?: number } {
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
      const findUrl = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
      findUrl.searchParams.set('input', placeName);
      findUrl.searchParams.set('inputtype', 'textquery');
      findUrl.searchParams.set('fields', 'place_id');
      findUrl.searchParams.set('key', apiKey);
      if (lat != null && lng != null) {
        findUrl.searchParams.set('locationbias', `circle:2000@${lat},${lng}`);
      }
      const findRes = await axios.get<{ candidates?: { place_id: string }[] }>(findUrl.toString(), {
        timeout: 10000,
      });
      const placeId = findRes.data?.candidates?.[0]?.place_id;
      if (!placeId) {
        this.logger.warn(`No place found for: ${placeName}`);
        return null;
      }

      const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
      detailsUrl.searchParams.set('place_id', placeId);
      detailsUrl.searchParams.set(
        'fields',
        'name,formatted_address,formatted_phone_number,website',
      );
      detailsUrl.searchParams.set('key', apiKey);
      const detailsRes = await axios.get<{
        result?: {
          name?: string;
          formatted_address?: string;
          formatted_phone_number?: string;
          website?: string;
        };
      }>(detailsUrl.toString(), { timeout: 10000 });
      const r = detailsRes.data?.result;
      if (!r) return null;

      return {
        placeId,
        name: r.name ?? placeName,
        address: r.formatted_address,
        phone: r.formatted_phone_number,
        website: r.website,
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
      const mailtoMatch = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
      if (mailtoMatch) return mailtoMatch[1].trim();
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emails = html.match(emailRegex) || [];
      const filtered = emails.filter(
        (e) =>
          !/^(noreply|no-reply|support@|admin@|donotreply|image|email|example|test@)/i.test(e) &&
          !e.endsWith('.png') &&
          !e.endsWith('.jpg'),
      );
      return filtered[0]?.trim() ?? null;
    } catch (e) {
      this.logger.warn('Find email from website failed', e);
      return null;
    }
  }

  async sendOnboarding(dto: SendOnboardingDto): Promise<{ ok: boolean; error?: string }> {
    const fromEmail =
      this.configService.get<string>('GTM_FROM_EMAIL') ||
      this.configService.get<string>('RESEND_FROM') ||
      'Jukebox <onboarding@resend.dev>';
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const signupUrl = this.configService.get<string>('FRONTEND_URL') || 'https://muzobox.com';
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Jukebox for your venue</title></head>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#333;">
  <h1 style="color:#E11D48;">Turn your venue into a jukebox</h1>
  <p>Hi,</p>
  <p>We’re <strong>Jukebox</strong> — a simple way to let your customers request and pay for songs at your bar or venue.</p>
  <ul>
    <li>Guests scan a QR code, pick a song, and pay (e.g. UPI).</li>
    <li>You control the queue and what’s playing from one dashboard.</li>
    <li>No hardware: use your existing speakers and phone.</li>
  </ul>
  <p>Perfect for bars, cafes, and parties.</p>
  <p><a href="${signupUrl}/admin/login" style="display:inline-block;background:#E11D48;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;">Get started — sign up here</a></p>
  <p>If you have questions, just reply to this email. We’re happy to help.</p>
  <p>Cheers,<br/>The Jukebox team</p>
</body>
</html>
`;
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not set — storing lead only');
      await this.saveLead(dto, 'skipped_no_provider');
      return { ok: false, error: 'Email provider not configured' };
    }
    try {
      await axios.post(
        'https://api.resend.com/emails',
        {
          from: fromEmail,
          to: [dto.email],
          subject: `Jukebox for ${dto.placeName}`,
          html,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );
      await this.saveLead(dto, 'sent');
      this.logger.log(`Onboarding email sent to ${dto.email} for ${dto.placeName}`);
      return { ok: true };
    } catch (e) {
      const message = axios.isAxiosError(e) ? e.response?.data?.message : (e as Error).message;
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
