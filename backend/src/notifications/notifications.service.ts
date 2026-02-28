import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushSubscription } from './push-subscription.entity';
import { SubscribePushDto } from './dto/subscribe-push.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private webPush: { setVapidDetails: (a: string, b: string, c: string) => void; sendNotification: (sub: unknown, payload: string) => Promise<unknown> } | null = null;

  constructor(
    @InjectRepository(PushSubscription)
    private readonly subscriptionRepository: Repository<PushSubscription>,
  ) {
    this.initWebPush();
  }

  private initWebPush(): void {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) {
      this.logger.warn('VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY not set — push notifications disabled');
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const wp = require('web-push');
      wp.setVapidDetails('mailto:support@muzobox.com', publicKey, privateKey);
      this.webPush = wp;
      this.logger.log('Web push initialized');
    } catch (e) {
      this.logger.warn('web-push not available — push notifications disabled', e);
    }
  }

  getVapidPublicKey(): string | null {
    return process.env.VAPID_PUBLIC_KEY ?? null;
  }

  async subscribe(dto: SubscribePushDto): Promise<{ ok: boolean }> {
    if (!dto.subscription?.endpoint || !dto.subscription?.keys?.p256dh || !dto.subscription?.keys?.auth) {
      return { ok: false };
    }
    if (dto.venueId) {
      const existing = await this.subscriptionRepository.findOne({
        where: { venueId: dto.venueId, endpoint: dto.subscription.endpoint },
      });
      if (existing) {
        return { ok: true };
      }
      await this.subscriptionRepository.save(
        this.subscriptionRepository.create({
          venueId: dto.venueId,
          endpoint: dto.subscription.endpoint,
          p256dh: dto.subscription.keys.p256dh,
          auth: dto.subscription.keys.auth,
        }),
      );
      this.logger.log(`Admin push subscription for venue ${dto.venueId}`);
    } else if (dto.orderId) {
      await this.subscriptionRepository.upsert(
        {
          orderId: dto.orderId,
          endpoint: dto.subscription.endpoint,
          p256dh: dto.subscription.keys.p256dh,
          auth: dto.subscription.keys.auth,
        },
        ['orderId'],
      );
      this.logger.log(`Customer push subscription for order ${dto.orderId}`);
    } else {
      return { ok: false };
    }
    return { ok: true };
  }

  async notifyAdminNewSongQueued(venueId: string, songTitle: string): Promise<void> {
    const subs = await this.subscriptionRepository.find({ where: { venueId } });
    if (subs.length === 0) return;
    const payload = JSON.stringify({
      title: 'New song queued',
      body: songTitle,
      tag: `venue:${venueId}:queue`,
    });
    await this.sendToSubscriptions(subs, payload);
  }

  async notifyCustomerSongPlaying(orderId: string, songTitle: string): Promise<void> {
    const sub = await this.subscriptionRepository.findOne({ where: { orderId } });
    if (!sub) return;
    const payload = JSON.stringify({
      title: "Your song is now playing!",
      body: songTitle,
      tag: `order:${orderId}`,
    });
    await this.sendToSubscriptions([sub], payload);
    await this.subscriptionRepository.remove(sub);
  }

  private async sendToSubscriptions(
    subs: PushSubscription[],
    payload: string,
  ): Promise<void> {
    if (!this.webPush) return;
    for (const sub of subs) {
      const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await this.webPush.sendNotification(subscription, payload);
      } catch (e) {
        this.logger.warn(`Push failed for ${sub.id}`, e);
        try {
          await this.subscriptionRepository.remove(sub);
        } catch {
          // ignore
        }
      }
    }
  }
}
