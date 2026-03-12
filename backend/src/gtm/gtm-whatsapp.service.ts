import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { GtmWhatsappConversation } from './gtm-whatsapp-conversation.entity';
import { GtmWhatsappMessage } from './gtm-whatsapp-message.entity';
import { Venue } from '../venues/venue.entity';
import { WasenderApiService } from './wasender-api.service';

export interface SendWhatsappToBarsDto {
  bars: Array<{ phone: string; barName?: string }>;
  message: string;
  adminId?: string;
}

export interface WasenderWebhookPayload {
  event?: string;
  data?: {
    messages?: {
      key?: {
        id?: string;
        fromMe?: boolean;
        cleanedSenderPn?: string;
        remoteJid?: string;
      };
      messageBody?: string;
    };
  };
}

@Injectable()
export class GtmWhatsappService {
  private readonly logger = new Logger(GtmWhatsappService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(GtmWhatsappConversation)
    private readonly conversationRepo: Repository<GtmWhatsappConversation>,
    @InjectRepository(GtmWhatsappMessage)
    private readonly messageRepo: Repository<GtmWhatsappMessage>,
    private readonly wasenderApi: WasenderApiService,
  ) {}

  private static delayMs(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Send WhatsApp to selected bars; create conversation + outbound message per bar. Appends onboard link per conversation. */
  async sendToBars(
    dto: SendWhatsappToBarsDto,
  ): Promise<{ sent: number; failed: number }> {
    const baseUrl =
      this.configService.get<string>('FRONTEND_URL') || 'https://muzobox.com';
    const delayBetweenSends =
      Number(this.configService.get<string>('WASENDER_SEND_DELAY_MS')) || 3000;
    let sent = 0;
    let failed = 0;
    const total = dto.bars.length;
    for (let i = 0; i < total; i++) {
      const bar = dto.bars[i];
      const phone = this.wasenderApi.normalizePhone(bar.phone);
      if (!phone) {
        failed += 1;
        continue;
      }
      let conversation = await this.conversationRepo.findOne({
        where: { phone },
      });
      if (!conversation) {
        conversation = this.conversationRepo.create({
          phone,
          barName: bar.barName ?? null,
          createdByAdminId: dto.adminId ?? null,
        });
        await this.conversationRepo.save(conversation);
      } else if (!conversation.createdByAdminId && dto.adminId) {
        await this.conversationRepo.update(conversation.id, {
          createdByAdminId: dto.adminId,
        });
        conversation.createdByAdminId = dto.adminId;
      }
      const demoLink = `${baseUrl}/sample-bar?from=whatsapp-onboard`;
      const messageWithLink =
        dto.message.trim() +
        '\n\nCheck out MuzoBox and get onboarded: ' +
        demoLink;
      const result = await this.wasenderApi.sendTextMessage(
        phone,
        messageWithLink,
      );
      if (result?.success) {
        await this.messageRepo.save(
          this.messageRepo.create({
            conversationId: conversation.id,
            direction: 'out',
            body: messageWithLink,
            externalId: result.msgId != null ? String(result.msgId) : null,
            isAiReply: false,
          }),
        );
        void this.conversationRepo.update(conversation.id, {
          updatedAt: new Date(),
          barName: bar.barName ?? conversation.barName,
        });
        sent += 1;
      } else {
        failed += 1;
      }
      if (i < total - 1 && delayBetweenSends > 0) {
        await GtmWhatsappService.delayMs(delayBetweenSends);
      }
    }
    return { sent, failed };
  }

  /** Handle WasenderAPI webhook: store inbound message. */
  async handleWebhook(payload: WasenderWebhookPayload): Promise<void> {
    if (payload?.event !== 'messages.received') return;
    const messages = payload?.data?.messages;
    if (!messages?.key || messages.key.fromMe) return;
    const phone = messages.key.cleanedSenderPn ?? messages.key.remoteJid;
    if (!phone) return;
    const body = (messages.messageBody ?? '').trim();
    const externalId = messages.key.id ?? null;
    const normalizedPhone = this.wasenderApi.normalizePhone(phone);
    let conversation = await this.conversationRepo.findOne({
      where: { phone: normalizedPhone },
    });
    if (!conversation) {
      conversation = this.conversationRepo.create({
        phone: normalizedPhone,
        barName: null,
      });
      await this.conversationRepo.save(conversation);
    }
    const existing = externalId
      ? await this.messageRepo.findOne({ where: { externalId } })
      : null;
    if (existing) return;
    await this.messageRepo.save(
      this.messageRepo.create({
        conversationId: conversation.id,
        direction: 'in',
        body: body || '(no text)',
        externalId,
        isAiReply: false,
      }),
    );
    this.conversationRepo.update(conversation.id, { updatedAt: new Date() });
  }

  /** Find conversations where last message is inbound and we haven't replied yet. */
  private async getConversationsNeedingReply(): Promise<
    GtmWhatsappConversation[]
  > {
    const convos = await this.conversationRepo.find({
      order: { updatedAt: 'DESC' },
      take: 100,
    });
    const out: GtmWhatsappConversation[] = [];
    for (const c of convos) {
      const lastMsg = await this.messageRepo.findOne({
        where: { conversationId: c.id },
        order: { createdAt: 'DESC' },
      });
      if (lastMsg?.direction === 'in') out.push(c);
    }
    return out;
  }

  /** Generate reply using OpenAI given conversation context. */
  private async generateReplyWithOpenAI(
    barName: string | null,
    lastInboundBody: string,
    recentMessages: { direction: string; body: string }[],
  ): Promise<string> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) return '';
    const signupUrl =
      this.configService.get<string>('FRONTEND_URL') || 'https://muzobox.com';
    const registerUrl = `${signupUrl}/admin/register`;
    const prompt = `You are Kartik from MuzoBox, helping bars and restaurants adopt MuzoBox (a jukebox app for venues). Keep replies short, friendly, and in plain text (no markdown). Do not make up signup links; use this exact link only when inviting them to sign up: ${registerUrl}

Recent conversation (oldest first):
${recentMessages.map((m) => `${m.direction === 'in' ? 'Them' : 'You'}: ${m.body}`).join('\n')}

Their latest message: "${lastInboundBody}"
${barName ? `Venue/bar name: ${barName}` : ''}

Reply in 1-3 short sentences. If they want to sign up, include the link. Do not be pushy.`;
    try {
      const res = await axios.post<{
        choices?: Array<{ message?: { content?: string } }>;
      }>(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
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
      const text = res.data?.choices?.[0]?.message?.content?.trim() ?? '';
      return text;
    } catch (e) {
      this.logger.warn('OpenAI reply generation failed', e);
      return '';
    }
  }

  /** Process one conversation: generate AI reply and send via WasenderAPI. */
  async processConversationReply(
    conversation: GtmWhatsappConversation,
  ): Promise<boolean> {
    const messages = await this.messageRepo.find({
      where: { conversationId: conversation.id },
      order: { createdAt: 'ASC' },
      take: 30,
    });
    const last = messages[messages.length - 1];
    if (!last || last.direction !== 'in') return false;
    const reply = await this.generateReplyWithOpenAI(
      conversation.barName,
      last.body,
      messages.map((m) => ({ direction: m.direction, body: m.body })),
    );
    if (!reply.trim()) return false;
    const result = await this.wasenderApi.sendTextMessage(
      conversation.phone,
      reply,
    );
    if (!result?.success) return false;
    await this.messageRepo.save(
      this.messageRepo.create({
        conversationId: conversation.id,
        direction: 'out',
        body: reply,
        externalId: result.msgId != null ? String(result.msgId) : null,
        isAiReply: true,
      }),
    );
    this.conversationRepo.update(conversation.id, { updatedAt: new Date() });
    this.logger.log(
      `AI reply sent to ${conversation.phone} (${conversation.barName ?? 'unknown'})`,
    );
    return true;
  }

  /** Cron: reply to all conversations that need an AI reply. */
  async processPendingReplies(): Promise<{ processed: number }> {
    const conversations = await this.getConversationsNeedingReply();
    let processed = 0;
    for (const c of conversations) {
      const ok = await this.processConversationReply(c);
      if (ok) processed += 1;
    }
    return { processed };
  }

  async getConversations(limit = 50): Promise<
    Array<{
      id: string;
      phone: string;
      barName: string | null;
      updatedAt: Date;
      lastMessagePreview: string | null;
      lastMessageAt: Date | null;
    }>
  > {
    const list = await this.conversationRepo.find({
      order: { updatedAt: 'DESC' },
      take: limit,
    });
    const result = await Promise.all(
      list.map(async (c) => {
        const lastMsg = await this.messageRepo.findOne({
          where: { conversationId: c.id },
          order: { createdAt: 'DESC' },
        });
        return {
          id: c.id,
          phone: c.phone,
          barName: c.barName,
          updatedAt: c.updatedAt,
          lastMessagePreview: lastMsg
            ? lastMsg.body.slice(0, 80) + (lastMsg.body.length > 80 ? '…' : '')
            : null,
          lastMessageAt: lastMsg?.createdAt ?? null,
        };
      }),
    );
    return result;
  }

  async getMessages(conversationId: string): Promise<GtmWhatsappMessage[]> {
    return this.messageRepo.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });
  }

  /** Public: get context for /onboard?c=xxx (bar name, phone, already onboarded?). */
  async getOnboardContext(conversationId: string): Promise<{
    barName: string | null;
    phone: string | null;
    conversationId: string;
    alreadyOnboarded: boolean;
    venueSlug: string | null;
  } | null> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId },
    });
    if (!conversation) return null;
    let venueSlug: string | null = null;
    if (conversation.onboardedVenueId) {
      const venueRepo = this.conversationRepo.manager.getRepository(Venue);
      const venue = await venueRepo.findOne({
        where: { id: conversation.onboardedVenueId },
      });
      venueSlug = venue?.slug ?? null;
    }
    return {
      barName: conversation.barName,
      phone: conversation.phone,
      conversationId: conversation.id,
      alreadyOnboarded: !!conversation.onboardedVenueId,
      venueSlug,
    };
  }

  /** Set onboarded venue on conversation (called by GtmOnboardService after venue creation). */
  async setOnboardedVenue(
    conversationId: string,
    venueId: string,
  ): Promise<void> {
    await this.conversationRepo.update(conversationId, {
      onboardedVenueId: venueId,
    });
  }
}
