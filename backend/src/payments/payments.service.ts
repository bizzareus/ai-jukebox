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
import type {
  RazorpayWebhookPayload,
  RazorpayPaymentEntity,
  RazorpayOrderCreateResponse,
  RazorpayQrFetchResponse,
  RazorpayQrFetchPaymentsResponse,
} from './types/razorpay.types';
import type { CreateOrderResult } from './interfaces/create-order-result.interface';
import {
  QR_CLOSE_BY_SECONDS,
  RAZORPAY_RECEIPT_MAX_LENGTH,
  RAZORPAY_DESCRIPTION_MAX_LENGTH,
  QR_FETCH_PAYMENTS_COUNT,
  PROXY_QR_IMAGE_TIMEOUT_MS,
} from './payments.constants';

export interface OrderStatusResult {
  status: 'created' | 'paid';
  queueItem?: { id: string; position: number; eta: number };
}

export interface VenueEarningsResult {
  payments: Array<{
    id: string;
    amount: number;
    createdAt: Date;
    songId: string;
    songTitle: string | null;
    qrid: string | null;
    customerName: string | null;
    customerMobile: string | null;
    status: PaymentStatus;
    razorpayPaymentId: string | null;
  }>;
  total: number;
  count: number;
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

  /** Effective price after flat discount (minimum ₹1). */
  private effectivePrice(venue: {
    pricePerSong: number;
    discountAmount?: number;
  }): number {
    const discount = venue.discountAmount ?? 0;
    return Math.max(1, venue.pricePerSong - discount);
  }

  /** Truncate string to max length for Razorpay fields. */
  private truncate(value: string, maxLength: number): string {
    return value.slice(0, maxLength);
  }

  async createOrder(dto: CreateOrderDto): Promise<CreateOrderResult> {
    const [venue, song] = await Promise.all([
      this.venuesService.findById(dto.venueId),
      this.songsService.findById(dto.songId),
    ]);

    if (venue.pricingEnabled === false) {
      throw new BadRequestException(
        'Paid orders are not available for this venue. Add songs from the venue page without payment.',
      );
    }

    const amount = this.effectivePrice(venue);
    const amountPaise = amount * 100;

    const qr = await this.createRazorpayQr(venue.name, song.title, amountPaise);
    const payment = await this.persistPayment(
      venue.id,
      song.id,
      dto.customerName,
      dto.customerMobile,
      qr.id,
      amount,
    );

    const razorpayOrderId = await this.createRazorpayOrderForCheckout(
      payment,
      amountPaise,
    );
    const upiString = await this.fetchQrImageContent(qr.id);
    const razorpayKeyId =
      this.configService.get<string>('RAZORPAY_KEY_ID') ?? undefined;

    this.logger.log(
      `Created payment ${payment.id} (QR ${qr.id}) for "${song.title}" at ${venue.name}`,
    );
    if (razorpayOrderId) {
      this.logger.log(
        `Pay Online: Razorpay Order ID ${razorpayOrderId} for payment ${payment.id} (frontend polls with paymentId=${payment.id})`,
      );
    }

    return {
      orderId: payment.id,
      paymentId: payment.id,
      amount,
      upiString,
      qrImageUrl: upiString ? undefined : qr.image_url,
      razorpayOrderId: razorpayOrderId ?? undefined,
      razorpayKeyId,
      song: {
        id: song.id,
        title: song.title,
        thumbnailUrl: song.thumbnailUrl,
      },
      venue: { id: venue.id, name: venue.name },
    };
  }

  private async createRazorpayQr(
    venueName: string,
    songTitle: string,
    amountPaise: number,
  ): Promise<{ id: string; image_url?: string }> {
    const closeBy = Math.floor(Date.now() / 1000) + QR_CLOSE_BY_SECONDS;
    const qr = await this.razorpay.qrCode.create({
      type: 'upi_qr',
      name: this.truncate(
        `Jukebox ${venueName}`,
        RAZORPAY_DESCRIPTION_MAX_LENGTH,
      ),
      usage: 'single_use',
      fixed_amount: true,
      payment_amount: amountPaise,
      description: this.truncate(
        `${venueName} - ${songTitle}`,
        RAZORPAY_DESCRIPTION_MAX_LENGTH,
      ),
      close_by: closeBy,
    } as Parameters<Razorpay['qrCode']['create']>[0]);
    return qr as { id: string; image_url?: string };
  }

  private async persistPayment(
    venueId: string,
    songId: string,
    customerName: string | undefined,
    customerMobile: string | undefined,
    razorpayQrId: string,
    amount: number,
  ): Promise<Payment> {
    const payment = this.paymentRepository.create({
      venueId,
      songId,
      customerName,
      customerMobile,
      razorpayQrId,
      amount,
      status: PaymentStatus.CREATED,
    });
    return this.paymentRepository.save(payment);
  }

  private async createRazorpayOrderForCheckout(
    payment: Payment,
    amountPaise: number,
  ): Promise<string | null> {
    try {
      const order = await this.razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: this.truncate(payment.id, RAZORPAY_RECEIPT_MAX_LENGTH),
      });
      const orderResponse = order as RazorpayOrderCreateResponse;
      if (orderResponse?.id) {
        payment.razorpayOrderId = orderResponse.id;
        await this.paymentRepository.save(payment);
        this.logger.log(
          `Razorpay Order created: ${orderResponse.id} for payment ${payment.id} (Pay Online webhook will use this order_id)`,
        );
        return orderResponse.id;
      }
    } catch (err) {
      this.logger.warn(
        `Razorpay Order creation failed for payment ${payment.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return null;
  }

  private async fetchQrImageContent(qrId: string): Promise<string> {
    try {
      const fetched = await this.razorpay.qrCode.fetch(qrId);
      const withContent = fetched as RazorpayQrFetchResponse;
      return withContent?.image_content ?? '';
    } catch (err) {
      this.logger.warn(
        `Could not fetch QR image_content for ${qrId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return '';
    }
  }

  async handleWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): Promise<{ received: boolean }> {
    this.logger.log(
      `Webhook received: rawBody=${rawBody ? `${rawBody.length} bytes` : 'MISSING'}, signature=${signature ? 'present' : 'MISSING'}`,
    );

    this.validateWebhookInputs(rawBody, signature);
    const payload = this.parseWebhookPayload(rawBody!);
    this.validateWebhookSignature(
      payload,
      rawBody!.toString(),
      signature!.trim(),
    );

    const event = payload.event;
    this.logger.log(`Razorpay webhook: ${event}`);

    if (event === 'payment.captured') {
      const entity = this.getPaymentEntityFromPayload(payload);
      if (!entity) {
        this.logger.warn('Razorpay webhook: payment entity missing');
        return { received: true };
      }
      this.logger.log(
        `payment.captured: Razorpay order_id=${entity.order_id}, payment id=${entity.id} (order_id is QR id or Razorpay Order id for Pay Online)`,
      );
      await this.handlePaymentCaptured(entity);
      return { received: true };
    }

    if (event === 'qr_code.credited') {
      const qrEntity =
        payload?.payload?.qr_code?.entity ?? payload?.qr_code?.entity;
      const paymentEntity = this.getPaymentEntityFromPayload(payload);
      if (!qrEntity?.id) {
        this.logger.warn(
          'Razorpay webhook: qr_code entity missing in qr_code.credited',
        );
        return { received: true };
      }
      await this.handleQrCodeCredited(qrEntity.id, paymentEntity?.id);
      return { received: true };
    }

    return { received: true };
  }

  private validateWebhookInputs(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): void {
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      this.logger.error(
        'Webhook raw body missing. Start Nest with rawBody: true and do not parse body before webhook.',
      );
      throw new BadRequestException('Webhook body required');
    }
    if (!signature?.trim()) {
      this.logger.warn('Webhook x-razorpay-signature header missing');
      throw new BadRequestException('Missing x-razorpay-signature header');
    }
    const secret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.error('RAZORPAY_WEBHOOK_SECRET is not set');
      throw new BadRequestException('Webhook not configured');
    }
  }

  private parseWebhookPayload(rawBody: Buffer): RazorpayWebhookPayload {
    try {
      return JSON.parse(rawBody.toString()) as RazorpayWebhookPayload;
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }
  }

  private validateWebhookSignature(
    payload: RazorpayWebhookPayload,
    rawBodyString: string,
    signature: string,
  ): void {
    const secret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET')!;
    const bodyForValidation = payload.event?.startsWith('qr_code.')
      ? JSON.stringify(payload).replace(/\//g, '\\/')
      : rawBodyString;
    try {
      const isValid = validateWebhookSignature(
        bodyForValidation,
        signature,
        secret,
      );
      if (!isValid) {
        this.logger.warn(
          'Webhook signature mismatch. Verify RAZORPAY_WEBHOOK_SECRET matches Razorpay Dashboard → Webhooks.',
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
  }

  private getPaymentEntityFromPayload(
    payload: RazorpayWebhookPayload,
  ): RazorpayPaymentEntity | undefined {
    return payload?.payload?.payment?.entity ?? payload?.payment?.entity;
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
    return this.markPaymentPaidAndEnqueue(
      payment,
      razorpayPaymentId,
      `QR code credited: ${qrCodeId}`,
    );
  }

  private async handlePaymentCaptured(
    paymentEntity: RazorpayPaymentEntity,
  ): Promise<Payment | null> {
    const { order_id: qrIdOrOrderId, id: razorpayPaymentId } = paymentEntity;
    if (!qrIdOrOrderId || !razorpayPaymentId) {
      this.logger.warn(
        'Razorpay webhook: missing order_id or payment id in entity',
      );
      return null;
    }

    this.logger.log(
      `Looking up payment by razorpayQrId or razorpayOrderId: ${qrIdOrOrderId}`,
    );
    const payment = await this.paymentRepository.findOne({
      where: [
        { razorpayQrId: qrIdOrOrderId },
        { razorpayOrderId: qrIdOrOrderId },
      ],
    });
    if (!payment) {
      this.logger.warn(
        `No payment found for QR/order ${qrIdOrOrderId} (check DB has razorpay_order_id set for Pay Online)`,
      );
      return null;
    }
    this.logger.log(
      `Found payment ${payment.id} (razorpayOrderId=${payment.razorpayOrderId ?? 'null'}, razorpayQrId=${payment.razorpayQrId ?? 'null'})`,
    );

    return this.markPaymentPaidAndEnqueue(
      payment,
      razorpayPaymentId,
      `Payment captured: ${razorpayPaymentId} for ${qrIdOrOrderId}`,
    );
  }

  /**
   * Mark payment as PAID, optionally set razorpayPaymentId, save, and enqueue.
   * Idempotent: no-op if already PAID.
   */
  private async markPaymentPaidAndEnqueue(
    payment: Payment,
    razorpayPaymentId: string | undefined,
    logContext: string,
  ): Promise<Payment | null> {
    if (payment.status === PaymentStatus.PAID) {
      this.logger.log(`${logContext} — already processed, skipping`);
      return payment;
    }
    if (razorpayPaymentId) payment.razorpayPaymentId = razorpayPaymentId;
    payment.status = PaymentStatus.PAID;
    const saved = await this.paymentRepository.save(payment);
    this.logger.log(
      `${logContext} → payment ${saved.id} (Razorpay pay id: ${razorpayPaymentId ?? 'n/a'})`,
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
    return this.paymentRepository.findOne({ where: { id: orderId } });
  }

  /**
   * Order status for polling. Accepts our paymentId (UUID) or Razorpay order id.
   * For QR flow, may sync payment status from Razorpay if not yet paid.
   */
  async getOrderStatus(orderIdOrPaymentId: string): Promise<OrderStatusResult> {
    this.logger.log(
      `getOrderStatus called with orderIdOrPaymentId=${orderIdOrPaymentId}`,
    );
    const payment = await this.paymentRepository.findOne({
      where: { id: orderIdOrPaymentId },
    });
    if (!payment) {
      this.logger.warn(
        `getOrderStatus: no payment found for ${orderIdOrPaymentId}`,
      );
      throw new NotFoundException('Order not found');
    }

    if (payment.status !== PaymentStatus.PAID && payment.razorpayQrId) {
      this.logger.log(
        `getOrderStatus: payment ${payment.id} not paid, syncing QR ${payment.razorpayQrId} from Razorpay (Pay Online uses webhook, not QR sync)`,
      );
      await this.syncQrPaymentFromRazorpay(payment);
    }

    if (payment.status !== PaymentStatus.PAID) {
      this.logger.log(
        `getOrderStatus: returning status=created for payment ${payment.id} (razorpayOrderId=${payment.razorpayOrderId ?? 'null'})`,
      );
      return { status: 'created' };
    }

    const queueItem = await this.queueService.getQueueItemWithEtaByPaymentId(
      payment.id,
    );
    this.logger.log(
      `getOrderStatus: returning status=paid for payment ${payment.id}`,
    );
    return {
      status: 'paid',
      queueItem: queueItem ?? undefined,
    };
  }

  private async syncQrPaymentFromRazorpay(payment: Payment): Promise<void> {
    const qrId = payment.razorpayQrId!;
    try {
      const res = (await this.razorpay.qrCode.fetchAllPayments(qrId, {
        count: QR_FETCH_PAYMENTS_COUNT,
      })) as RazorpayQrFetchPaymentsResponse;
      const items = res?.items ?? [];
      const captured = items.find((p) => p.status === 'captured');
      const razorpayPaymentId =
        captured && typeof captured.id === 'string' ? captured.id : null;
      if (razorpayPaymentId) {
        await this.markPaymentPaidAndEnqueue(
          payment,
          razorpayPaymentId,
          `QR ${qrId} payment detected via fetch`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Fetch payments for QR ${qrId} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async getVenueEarnings(
    venueId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<VenueEarningsResult> {
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

    return {
      payments: payments.map((p) => ({
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
      })),
      total,
      count: paidOnly.length,
    };
  }

  /**
   * Proxy Razorpay QR image URL so frontend can load it without CORS.
   * Only allows rzp.io and api.razorpay.com.
   */
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
      timeout: PROXY_QR_IMAGE_TIMEOUT_MS,
    });
    const rawContentType = res.headers['content-type'] as string | undefined;
    const contentType =
      (typeof rawContentType === 'string'
        ? rawContentType.split(';')[0]?.trim()
        : null) || 'image/png';
    return {
      buffer: Buffer.from(res.data),
      contentType,
    };
  }
}
