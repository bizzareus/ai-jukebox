import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { GtmLead } from './gtm-lead.entity';
import { GtmWhatsappConversation } from './gtm-whatsapp-conversation.entity';
import { SendOnboardingDto } from './dto/send-onboarding.dto';
import { InviteTokenService } from './invite-token.service';
import { WasenderApiService } from './wasender-api.service';

export interface ResolvedPlace {
  placeId: string;
  name: string;
  address?: string;
  phone?: string;
  website?: string;
}

export interface OpenAIBarItem {
  name: string;
  address?: string;
  possibleDirectorName?: string;
  phone?: string;
  website?: string;
  area?: string;
}

/** Bar/venue from Google Places Nearby Search (lat/lng + 5km radius). Phone is mobile-only (landline stripped). */
export interface BarFromLocation {
  placeId: string;
  name: string;
  address?: string;
  phone?: string;
  website?: string;
}

/** Indian mobile: 10 digits starting with 6, 7, 8, or 9. Rejects landlines. */
function isIndianMobile(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) return true;
  if (
    digits.length === 11 &&
    digits.startsWith('0') &&
    /^0[6-9]\d{9}$/.test(digits)
  )
    return true;
  if (
    digits.length === 12 &&
    digits.startsWith('91') &&
    /^91[6-9]\d{9}$/.test(digits)
  )
    return true;
  return false;
}

@Injectable()
export class GtmService {
  private readonly logger = new Logger(GtmService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(GtmLead)
    private readonly gtmLeadRepository: Repository<GtmLead>,
    @InjectRepository(GtmWhatsappConversation)
    private readonly whatsappConversationRepo: Repository<GtmWhatsappConversation>,
    private readonly inviteTokenService: InviteTokenService,
    private readonly wasenderApi: WasenderApiService,
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

  private static readonly BARS_RADIUS_M = 5000;

  /** Offsets (lat, lng) in degrees to request more pages (API returns max 20 per request). */
  private static readonly BARS_PAGE_OFFSETS: [number, number][] = [
    [0, 0],
    [0.02, 0],
    [-0.02, 0],
    [0, 0.02],
    [0, -0.02],
    [0.02, 0.02],
    [-0.02, 0.02],
    [0.02, -0.02],
    [-0.02, -0.02],
  ];

  async findBarsByLocation(
    lat: number,
    lng: number,
    page = 0,
  ): Promise<{ bars: BarFromLocation[]; hasMore: boolean }> {
    const apiKey = this.configService.get<string>('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      this.logger.warn('GOOGLE_PLACES_API_KEY not set');
      return { bars: [], hasMore: false };
    }
    const offsetIndex = Math.min(page, GtmService.BARS_PAGE_OFFSETS.length - 1);
    const [latOff, lngOff] = GtmService.BARS_PAGE_OFFSETS[offsetIndex];
    const centerLat = lat + latOff;
    const centerLng = lng + lngOff;
    const hasMore = page < GtmService.BARS_PAGE_OFFSETS.length - 1;
    try {
      const searchRes = await axios.post<{
        places?: Array<{
          id?: string;
          displayName?: { text?: string };
          formattedAddress?: string;
          nationalPhoneNumber?: string;
          websiteUri?: string;
        }>;
      }>(
        'https://places.googleapis.com/v1/places:searchNearby',
        {
          locationRestriction: {
            circle: {
              center: { latitude: centerLat, longitude: centerLng },
              radius: GtmService.BARS_RADIUS_M,
            },
          },
          includedTypes: ['bar', 'night_club'],
          maxResultCount: 20,
        },
        {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask':
              'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri',
          },
        },
      );
      const places = searchRes.data?.places ?? [];
      const allBars: BarFromLocation[] = places
        .filter((p) => p.id)
        .map((p) => {
          const rawPhone = p.nationalPhoneNumber;
          const phone =
            rawPhone && isIndianMobile(rawPhone) ? rawPhone : undefined;
          return {
            placeId: p.id!,
            name: p.displayName?.text ?? 'Unknown',
            address: p.formattedAddress,
            phone,
            website: p.websiteUri,
          };
        });

      const contactedPhones = new Set<string>();
      const convos = await this.whatsappConversationRepo.find({
        select: ['phone'],
      });
      convos.forEach((c) => contactedPhones.add(c.phone));

      const bars = allBars.filter((bar) => {
        if (!bar.phone) return true;
        const normalized = this.wasenderApi.normalizePhone(bar.phone);
        return !contactedPhones.has(normalized);
      });

      this.logger.log(
        `findBarsByLocation: page ${page} → ${bars.length} bars (${allBars.length - bars.length} already contacted), hasMore=${hasMore}`,
      );
      return { bars, hasMore };
    } catch (e) {
      this.logger.warn('Places searchNearby failed', e);
      return { bars: [], hasMore: false };
    }
  }

  async findBarsByCity(city: string): Promise<OpenAIBarItem[]> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not set');
      return [];
    }
    const prompt = `List the top 100 bars, pubs, or nightlife venues in ${city} (India). For each venue provide:
- name: official or common name
- address: full address if known, else area/sector
- possibleDirectorName: owner, manager, or key contact name if you know it (otherwise null)
- phone: contact number if known (otherwise null)
- website: official website or social link if known (otherwise null)
- area: locality/sector (e.g. Cyber City, MG Road)

Return ONLY a valid JSON object with a single key "bars" whose value is an array of objects. No markdown, no code fence. Example: {"bars":[{"name":"Bar Name","address":"...","possibleDirectorName":"...","phone":null,"website":null,"area":"..."}]}`;

    try {
      const res = await axios.post<{
        choices?: Array<{
          message?: { content?: string };
        }>;
      }>(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          max_tokens: 16000,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        },
      );
      const raw = res.data?.choices?.[0]?.message?.content?.trim() ?? '';
      let parsed: { bars?: OpenAIBarItem[] };
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]) as { bars?: OpenAIBarItem[] };
      } else {
        parsed = JSON.parse(raw) as { bars?: OpenAIBarItem[] };
      }
      const bars = Array.isArray(parsed.bars) ? parsed.bars : [];
      this.logger.log(`OpenAI returned ${bars.length} bars for city: ${city}`);
      return bars.slice(0, 100);
    } catch (e) {
      this.logger.warn('OpenAI find-bars-by-city failed', e);
      return [];
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

  async getLeads(limit = 100): Promise<GtmLead[]> {
    return this.gtmLeadRepository.find({
      order: { sentAt: 'DESC' },
      take: Math.min(limit, 200),
    });
  }

  async sendOnboarding(
    dto: SendOnboardingDto,
    adminId?: string,
  ): Promise<{ ok: boolean; error?: string; linkedinMessage?: string }> {
    const contactName: string | undefined =
      typeof dto.contactName === 'string' ? dto.contactName : undefined;
    const fromEmail =
      this.configService.get<string>('GTM_FROM_EMAIL') ||
      this.configService.get<string>('RESEND_FROM') ||
      'Jukebox <kartik@muzobox.com>';
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const signupUrl =
      this.configService.get<string>('FRONTEND_URL') || 'https://muzobox.com';
    const inviteToken =
      adminId != null
        ? this.inviteTokenService.sign({
            email: dto.email,
            venueName: dto.placeName,
            address: dto.address,
            createdByAdminId: adminId,
          })
        : null;
    const signupLink = inviteToken
      ? `${signupUrl}/admin/register?invite=${encodeURIComponent(inviteToken)}`
      : `${signupUrl}/admin/login`;
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
  <p><a href="${signupLink}" style="display:inline-block;background:#E11D48;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;">Get started — sign up here</a></p>
  <p>If you have questions, reply to this email or call us at <a href="tel:+919999224767">+91 9999224767</a> to know more. We’re happy to help.</p>
  <p>Cheers,<br/>The Jukebox team</p>
</body>
</html>
`;
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not set — storing lead only');
      const linkedinMessage = this.buildLinkedInMessage(
        dto.placeName,
        signupLink,
        contactName,
      );
      await this.saveLead(dto, 'skipped_no_provider', adminId, linkedinMessage);
      return { ok: false, error: 'Email provider not configured' };
    }
    const replyTo = this.configService.get<string>('GTM_REPLY_TO');
    const ccEmail =
      this.configService.get<string>('GTM_CC_EMAIL') || 'me@kartikarora.in';
    const payload: Record<string, unknown> = {
      from: fromEmail,
      to: [dto.email],
      cc: [ccEmail],
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
      const linkedinMessage = this.buildLinkedInMessage(
        dto.placeName,
        signupLink,
        contactName,
      );
      await this.saveLead(dto, 'sent', adminId, linkedinMessage);
      this.logger.log(
        `Onboarding email sent to ${dto.email} for ${dto.placeName}`,
      );
      return { ok: true, linkedinMessage };
    } catch (e) {
      let message: string;
      if (axios.isAxiosError(e)) {
        const data = e.response?.data as { message?: string } | undefined;
        message =
          typeof data === 'object' && data != null && 'message' in data
            ? (data as { message: string }).message
            : (e as Error).message;
      } else {
        message = (e as Error).message;
      }
      this.logger.warn('Send onboarding failed', e);
      const linkedinMessage = this.buildLinkedInMessage(
        dto.placeName,
        signupLink,
        contactName,
      );
      await this.saveLead(dto, 'failed', adminId, linkedinMessage);
      return { ok: false, error: message ?? 'Failed to send email' };
    }
  }

  /** Returns the onboarding message text and signup link for a place (for GTM table display / copy). */
  getOnboardingMessage(
    placeName: string,
    options: {
      address?: string;
      placeId?: string;
      email?: string;
      contactName?: string;
    } = {},
    adminId?: string,
  ): { message: string; signupLink: string } {
    const signupUrl =
      this.configService.get<string>('FRONTEND_URL') || 'https://muzobox.com';
    let signupLink = `${signupUrl}/admin/login`;
    if (options.email && adminId != null && placeName.trim().length > 0) {
      const inviteToken = this.inviteTokenService.sign({
        email: options.email,
        venueName: placeName.trim(),
        address: options.address,
        createdByAdminId: adminId,
      });
      signupLink = `${signupUrl}/admin/register?invite=${encodeURIComponent(inviteToken)}`;
    } else {
      signupLink = `${signupUrl}/admin/register`;
    }
    const message = this.buildLinkedInMessage(
      placeName,
      signupLink,
      options.contactName,
    );
    return { message, signupLink };
  }

  private buildLinkedInMessage(
    _placeName: string,
    loginOrSignupUrl: string,
    contactName?: string,
  ): string {
    const name = (contactName?.trim() || 'there').replace(/\s+/g, ' ');
    return `Hi ${name}, I'm Kartik from MuzoBox 🎶

We help bars & restaurants boost customer engagement and drive extra revenue during non-DJ hours by letting your guests play music directly from their phones. With MuzoBox, your playlist is curated by you to match your venue's vibe, so customers choose from songs you've approved — keeping the music relevant and fun.

Get started here: ${loginOrSignupUrl}`;
  }

  /**
   * Use OpenAI to find a mobile number (and optionally contact name) for a venue in India.
   * Returns only if the number looks like an Indian mobile (10 digits, 6–9); landlines are excluded.
   */
  async findMobileWithOpenAI(
    venueName: string,
    address?: string,
  ): Promise<{ mobile: string | null; contactName: string | null }> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not set');
      return { mobile: null, contactName: null };
    }
    const location = address ? ` at ${address}` : '';
    const prompt = `For this bar/restaurant in India: "${venueName}"${location}.

Find the primary contact mobile number (Indian 10-digit number starting with 6, 7, 8, or 9). Do NOT return landline numbers.
If possible, also provide the contact person's name (owner, manager, or main contact).

Return ONLY a valid JSON object with two keys: "mobile" (string or null) and "contactName" (string or null).
Example: {"mobile":"9876543210","contactName":"Rahul"} or {"mobile":null,"contactName":null}
No markdown, no code fence.`;

    try {
      const res = await axios.post<{
        choices?: Array<{ message?: { content?: string } }>;
      }>(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          max_tokens: 256,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );
      const raw = res.data?.choices?.[0]?.message?.content?.trim() ?? '{}';
      const parsed = JSON.parse(raw) as {
        mobile?: string | null;
        contactName?: string | null;
      };
      let mobile: string | null =
        typeof parsed.mobile === 'string' ? parsed.mobile : null;
      if (mobile && !isIndianMobile(mobile)) {
        this.logger.debug(
          `OpenAI returned non-mobile number, discarding: ${mobile}`,
        );
        mobile = null;
      }
      const contactName =
        typeof parsed.contactName === 'string' ? parsed.contactName : null;
      return { mobile, contactName };
    } catch (e) {
      this.logger.warn('findMobileWithOpenAI failed', e);
      return { mobile: null, contactName: null };
    }
  }

  private async saveLead(
    dto: SendOnboardingDto,
    status: string,
    adminId?: string,
    linkedinMessage?: string,
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
        createdByAdminId: adminId ?? null,
        linkedinMessage: linkedinMessage ?? null,
      }),
    );
  }
}
