import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import Razorpay from 'razorpay';
import { validateWebhookSignature } from 'razorpay/dist/utils/razorpay-utils';
import { Payment, PaymentStatus } from './payment.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { VenuesService } from '../venues/venues.service';
import { SongsService } from '../songs/songs.service';
import { QueueService } from '../queue/queue.service';

/** Razorpay webhook payload (payment.captured or qr_code.credited). */
interface RazorpayWebhookPayload {
  event: string;
  payload?: {
    payment?: { entity?: RazorpayPaymentEntity };
    qr_code?: { entity?: { id: string } };
  };
  payment?: { entity?: RazorpayPaymentEntity };
  qr_code?: { entity?: { id: string } };
}

/** Razorpay payment entity from webhook. */
interface RazorpayPaymentEntity {
  id: string;
  order_id: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly razorpay: Razorpay;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly configService: ConfigService,
    private readonly venuesService: VenuesService,
    private readonly songsService: SongsService,
    @Inject(forwardRef(() => QueueService))
    private readonly queueService: QueueService,
  ) {
    this.razorpay = new Razorpay({
      key_id: this.configService.get<string>('RAZORPAY_KEY_ID'),
      key_secret: this.configService.get<string>('RAZORPAY_KEY_SECRET'),
    });
  }

  /** Effective price after flat discount (min 1). */
  private effectivePrice(venue: {
    pricePerSong: number;
    discountAmount?: number;
  }): number {
    const discount = venue.discountAmount ?? 0;
    return Math.max(1, venue.pricePerSong - discount);
  }

  async createOrder(dto: CreateOrderDto) {
    const venue = await this.venuesService.findById(dto.venueId);
    const song = await this.songsService.findById(dto.songId);

    const effective = this.effectivePrice(venue);
    const amountPaise = effective * 100;

    // Create Razorpay UPI QR (single-use, fixed amount); payment goes through Razorpay and triggers qr_code.credited webhook
    const closeBy = Math.floor(Date.now() / 1000) + 600; // 10 min
    const qr = await this.razorpay.qrCode.create({
      type: 'upi_qr',
      name: `Jukebox ${venue.name}`.slice(0, 255),
      usage: 'single_use',
      fixed_amount: true,
      payment_amount: amountPaise,
      description: `${venue.name} - ${song.title}`.slice(0, 255),
      close_by: closeBy,
    } as Parameters<Razorpay['qrCode']['create']>[0]);

    const payment = this.paymentRepository.create({
      venueId: venue.id,
      songId: song.id,
      customerName: dto.customerName,
      customerMobile: dto.customerMobile,
      razorpayQrId: qr.id,
      amount: effective,
      status: PaymentStatus.CREATED,
    });

    await this.paymentRepository.save(payment);

    // Fetch QR to get image_content (UPI string) so frontend can draw its own QR and "Open UPI App" link
    let upiString = '';
    try {
      const fetched = await this.razorpay.qrCode.fetch(qr.id);
      const qrWithContent = fetched as { image_content?: string };
      if (qrWithContent.image_content) {
        upiString = qrWithContent.image_content;
      }
    } catch (err) {
      this.logger.warn(
        `Could not fetch QR image_content for ${qr.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.logger.log(
      `Created QR ${qr.id} for song "${song.title}" at venue ${venue.name}`,
    );

    return {
      orderId: payment.id,
      paymentId: payment.id,
      amount: effective,
      upiString,
      qrImageUrl: upiString ? undefined : qr.image_url,
      song: { id: song.id, title: song.title, thumbnailUrl: song.thumbnailUrl },
      venue: { id: venue.id, name: venue.name },
    };
  }

  async handleWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ) {
    this.logger.log(
      `Webhook received: rawBody=${rawBody ? `${rawBody.length} bytes` : 'MISSING'}, signature=${signature ? 'present' : 'MISSING'}`,
    );

    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      this.logger.error(
        'Webhook raw body missing. Ensure Nest is started with rawBody: true and no middleware parses body before the webhook.',
      );
      throw new BadRequestException('Webhook body required');
    }

    if (!signature?.trim()) {
      this.logger.warn('Webhook x-razorpay-signature header missing');
      throw new BadRequestException('Missing x-razorpay-signature header');
    }

    const webhookSecret = this.configService.get<string>(
      'RAZORPAY_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      this.logger.error('RAZORPAY_WEBHOOK_SECRET is not set');
      throw new BadRequestException('Webhook not configured');
    }

    const rawBodyString = rawBody.toString();
    let payload: RazorpayWebhookPayload;
    try {
      payload = JSON.parse(rawBodyString) as RazorpayWebhookPayload;
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }

    // QR code webhooks require body with escaped slashes for signature validation (https://razorpay.com/docs/payments/qr-codes/subscribe-to-webhooks/)
    const bodyForValidation = payload.event?.startsWith('qr_code.')
      ? JSON.stringify(payload).replace(/\//g, '\\/')
      : rawBodyString;
    try {
      const isValid = validateWebhookSignature(
        bodyForValidation,
        signature.trim(),
        webhookSecret,
      );
      if (!isValid) {
        this.logger.warn(
          'Webhook signature mismatch. Check that RAZORPAY_WEBHOOK_SECRET matches the secret in Razorpay Dashboard → Webhooks.',
        );
        throw new BadRequestException('Invalid webhook signature');
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(
        `Webhook validation error: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = payload.event;

    this.logger.log(`Razorpay webhook: ${event}`);

    if (event === 'payment.captured') {
      const paymentEntity: RazorpayPaymentEntity | undefined =
        payload?.payload?.payment?.entity ?? payload?.payment?.entity;
      if (!paymentEntity) {
        this.logger.warn(
          'Razorpay webhook: payment entity missing from payload',
        );
        return { received: true };
      }
      try {
        await this.handlePaymentCaptured(paymentEntity);
      } catch (err) {
        this.logger.error(
          `Payment captured handling failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw err;
      }
    }

    if (event === 'qr_code.credited') {
      const qrEntity =
        payload?.payload?.qr_code?.entity ?? payload?.qr_code?.entity;
      const paymentEntity: RazorpayPaymentEntity | undefined =
        payload?.payload?.payment?.entity ?? payload?.payment?.entity;
      if (!qrEntity?.id) {
        this.logger.warn(
          'Razorpay webhook: qr_code entity missing from qr_code.credited payload',
        );
        return { received: true };
      }
      try {
        await this.handleQrCodeCredited(qrEntity.id, paymentEntity?.id);
      } catch (err) {
        this.logger.error(
          `qr_code.credited handling failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw err;
      }
    }

    return { received: true };
  }

  private async handleQrCodeCredited(
    qrCodeId: string,
    razorpayPaymentId: string | undefined,
  ): Promise<Payment | null> {
    const payment = await this.paymentRepository.findOne({
      where: { razorpayQrId: qrCodeId },
    });
    if (!payment) {
      this.logger.warn(`No payment found for QR code ${qrCodeId}`);
      return null;
    }
    if (payment.status === PaymentStatus.PAID) {
      this.logger.log(`QR ${qrCodeId} already processed — skipping`);
      return payment;
    }
    if (razorpayPaymentId) payment.razorpayPaymentId = razorpayPaymentId;
    payment.status = PaymentStatus.PAID;
    const saved = await this.paymentRepository.save(payment);
    this.logger.log(
      `QR code credited: ${qrCodeId} -> payment ${saved.id} (Razorpay pay id: ${razorpayPaymentId ?? 'n/a'})`,
    );
    try {
      await this.queueService.enqueueFromPayment(saved.id);
    } catch (err) {
      this.logger.error(
        `Enqueue from payment failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
    return saved;
  }

  private async handlePaymentCaptured(
    paymentEntity: RazorpayPaymentEntity,
  ): Promise<Payment | null> {
    const qrIdOrOrderId = paymentEntity.order_id;
    const razorpayPaymentId = paymentEntity.id;

    if (!qrIdOrOrderId || !razorpayPaymentId) {
      this.logger.warn(
        `Razorpay webhook: missing order_id or payment id in entity`,
      );
      return null;
    }

    const payment = await this.paymentRepository.findOne({
      where: { razorpayQrId: qrIdOrOrderId },
    });

    if (!payment) {
      this.logger.warn(`No payment found for QR/order ${qrIdOrOrderId}`);
      return null;
    }

    if (payment.status === PaymentStatus.PAID) {
      this.logger.log(`QR ${qrIdOrOrderId} already processed — skipping`);
      return payment;
    }

    payment.razorpayPaymentId = razorpayPaymentId;
    payment.status = PaymentStatus.PAID;
    const saved = await this.paymentRepository.save(payment);
    this.logger.log(
      `Payment captured: ${razorpayPaymentId} for QR ${qrIdOrOrderId}`,
    );

    try {
      await this.queueService.enqueueFromPayment(saved.id);
    } catch (err) {
      this.logger.error(
        `Enqueue from payment failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
    return saved;
  }

  async findByOrderId(orderId: string): Promise<Payment | null> {
    return this.paymentRepository.findOne({
      where: { id: orderId },
    });
  }

  /** Public order status for polling: status + queue item when paid. Accepts Razorpay orderId or our paymentId (UUID). For QR flow, fetches payments from Razorpay when not yet paid (see https://razorpay.com/docs/api/qr-codes/fetch-payments/). */
  async getOrderStatus(orderIdOrPaymentId: string): Promise<{
    status: 'created' | 'paid';
    queueItem?: { id: string; position: number; eta: number };
  }> {
    const payment = await this.paymentRepository.findOne({
      where: { id: orderIdOrPaymentId },
    });
    if (!payment) {
      throw new NotFoundException('Order not found');
    }

    if (payment.status !== PaymentStatus.PAID && payment.razorpayQrId) {
      const qrId: string = payment.razorpayQrId;
      try {
        const res = (await this.razorpay.qrCode.fetchAllPayments(qrId, {
          count: 10,
        })) as { items?: Array<{ id?: string; status?: string }> };
        const items = res?.items ?? [];
        const captured = items.find((p) => p.status === 'captured');
        const razorpayPaymentId =
          captured && typeof captured.id === 'string' ? captured.id : null;
        if (razorpayPaymentId) {
          payment.razorpayPaymentId = razorpayPaymentId;
          payment.status = PaymentStatus.PAID;
          await this.paymentRepository.save(payment);
          this.logger.log(
            `QR ${qrId} payment detected via fetch: ${razorpayPaymentId}`,
          );
          try {
            await this.queueService.enqueueFromPayment(payment.id);
          } catch (err) {
            this.logger.error(
              `Enqueue from payment failed: ${err instanceof Error ? err.message : String(err)}`,
            );
            throw err;
          }
        }
      } catch (err) {
        this.logger.warn(
          `Fetch payments for QR ${qrId} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (payment.status !== PaymentStatus.PAID) {
      return { status: 'created' };
    }
    const queueItem = await this.queueService.getQueueItemWithEtaByPaymentId(
      payment.id,
    );
    return {
      status: 'paid',
      queueItem: queueItem ?? undefined,
    };
  }

  async getVenueEarnings(venueId: string, startDate?: Date, endDate?: Date) {
    const qb = this.paymentRepository
      .createQueryBuilder('p')
      .where('p.venue_id = :venueId', { venueId });

    if (startDate) qb.andWhere('p.created_at >= :startDate', { startDate });
    if (endDate) qb.andWhere('p.created_at <= :endDate', { endDate });

    const payments = await qb
      .leftJoinAndSelect('p.song', 'song')
      .orderBy('p.created_at', 'DESC')
      .getMany();
    const paidOnly = payments.filter((p) => p.status === PaymentStatus.PAID);
    const total = paidOnly.reduce((sum, p) => sum + p.amount, 0);

    const paymentsDto = payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      createdAt: p.createdAt,
      songId: p.songId,
      songTitle: p.song?.title ?? null,
      qrid: p.razorpayQrId ?? null,
      customerName: p.customerName ?? null,
      customerMobile: p.customerMobile ?? null,
      status: p.status,
      razorpayPaymentId: p.razorpayPaymentId ?? null,
    }));

    return {
      payments: paymentsDto,
      total,
      count: paidOnly.length,
    };
  }

  private buildUpiString(
    vpa: string,
    venueName: string,
    amount: number,
    songTitle: string,
    orderId: string,
  ): string {
    const note = `Jukebox: ${songTitle}`.slice(0, 50);
    return `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(venueName)}&am=${amount}.00&tn=${encodeURIComponent(note)}&tr=${encodeURIComponent(orderId)}`;
  }

  /** Proxy a Razorpay QR image URL so the frontend can load it without CORS. Only allows rzp.io / api.razorpay.com. */
  async proxyQrImage(
    url: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const parsed = new URL(url);
    const allowed =
      parsed.hostname === 'rzp.io' ||
      parsed.hostname.endsWith('.rzp.io') ||
      parsed.hostname === 'api.razorpay.com';
    if (!allowed) {
      throw new BadRequestException('Invalid QR image URL');
    }
    const res = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      maxRedirects: 5,
      timeout: 10000,
    });
    const rawContentType = res.headers['content-type'] as string | undefined;
    const contentType =
      (typeof rawContentType === 'string'
        ? rawContentType.split(';')[0]?.trim()
        : null) || 'image/png';
    const buffer = Buffer.from(res.data);
    return { buffer, contentType };
  }
}
