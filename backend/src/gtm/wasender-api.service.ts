import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const WASENDER_BASE = 'https://www.wasenderapi.com';

export interface WasenderSendMessageResult {
  success: boolean;
  msgId?: number;
  jid?: string;
  status?: string;
}

@Injectable()
export class WasenderApiService {
  private readonly logger = new Logger(WasenderApiService.name);

  constructor(private readonly configService: ConfigService) {}

  private getApiKey(): string | null {
    return this.configService.get<string>('WASENDERAPI_API_KEY') ?? null;
  }

  /** Normalize phone to E.164 for WasenderAPI (e.g. 09266450404 or 9876543210 -> +919876543210). Strips leading 0 so Indian numbers are +91xxxxxxxxxx, never +0... */
  normalizePhone(phone: string): string {
    let digits = phone.replace(/\D/g, '');
    if (
      digits.startsWith('0') &&
      digits.length === 11 &&
      /^0[6-9]/.test(digits)
    )
      digits = digits.slice(1);
    if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    if (phone.startsWith('+') && digits.length >= 10) return `+${digits}`;
    return `+${digits}`;
  }

  private static delayMs(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Send a text message. Returns msgId on success. Retries once on 429 with delay. */
  async sendTextMessage(
    to: string,
    text: string,
    isRetry = false,
  ): Promise<WasenderSendMessageResult | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      this.logger.warn('WASENDERAPI_API_KEY not set');
      return null;
    }
    const normalizedTo = this.normalizePhone(to);
    try {
      const res = await axios.post<{
        success?: boolean;
        data?: { msgId?: number; jid?: string; status?: string };
      }>(
        `${WASENDER_BASE}/api/send-message`,
        { to: normalizedTo, text },
        {
          timeout: 15000,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
      const success = res.data?.success === true;
      const data = res.data?.data;
      if (success && data) {
        return {
          success: true,
          msgId: data.msgId,
          jid: data.jid,
          status: data.status,
        };
      }
      return { success: false };
    } catch (e: unknown) {
      const status = axios.isAxiosError(e) ? e.response?.status : null;
      const retryAfter =
        axios.isAxiosError(e) &&
        e.response &&
        typeof e.response.headers?.['retry-after'] === 'string'
          ? parseInt(e.response.headers['retry-after'], 10) * 1000
          : 60_000;

      if (status === 429 && !isRetry) {
        this.logger.warn(
          `WasenderAPI rate limited (429). Retrying after ${retryAfter}ms`,
        );
        await WasenderApiService.delayMs(
          Number.isNaN(retryAfter) ? 60_000 : Math.min(retryAfter, 120_000),
        );
        return this.sendTextMessage(to, text, true);
      }

      if (status === 429) {
        this.logger.warn(
          'WasenderAPI rate limited (429) again after retry. Increase WASENDER_SEND_DELAY_MS or send fewer messages.',
        );
      } else {
        const message = axios.isAxiosError(e)
          ? `${e.message}${e.response?.data ? ` — ${JSON.stringify(e.response.data)}` : ''}`
          : e instanceof Error
            ? e.message
            : 'Unknown error';
        this.logger.warn(`WasenderAPI send-message failed: ${message}`);
      }
      return null;
    }
  }
}
