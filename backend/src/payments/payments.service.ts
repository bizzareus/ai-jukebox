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
import Razorpay from 'razorpay';
import { validateWebhookSignature } from 'razorpay/dist/utils/razorpay-utils';
import { Payment, PaymentStatus } from './payment.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { VenuesService } from '../venues/venues.service';
import { SongsService } from '../songs/songs.service';
import { QueueService } from '../queue/queue.service';

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

  async createOrder(dto: CreateOrderDto) {
    const venue = await this.venuesService.findById(dto.venueId);
    const song = await this.songsService.findById(dto.songId);

    const amountPaise = venue.pricePerSong * 100;

    const order = await this.razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `jb_${Date.now()}`,
      notes: {
        venueId: venue.id,
        songId: song.id,
        songTitle: song.title,
        customerName: dto.customerName ?? '',
        customerMobile: dto.customerMobile ?? '',
      },
    });

    const payment = this.paymentRepository.create({
      venueId: venue.id,
      songId: song.id,
      customerName: dto.customerName,
      customerMobile: dto.customerMobile,
      razorpayOrderId: order.id,
      amount: venue.pricePerSong,
      status: PaymentStatus.CREATED,
    });

    await this.paymentRepository.save(payment);

    const upiString = this.buildUpiString(
      venue.upiVpa,
      venue.name,
      venue.pricePerSong,
      song.title,
      order.id,
    );

    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID') ?? '';
    const testMode = keyId.startsWith('rzp_test_');
    this.logger.log(
      `Created order ${order.id} for song "${song.title}" at venue ${venue.name}${testMode ? ' (test mode)' : ''}`,
    );

    return {
      orderId: order.id,
      paymentId: payment.id,
      amount: venue.pricePerSong,
      upiString,
      testMode,
      /** Only set in test mode; required to open Razorpay Checkout for simulating UPI (success@razorpay) */
      razorpayKeyId: testMode ? keyId : undefined,
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
    try {
      const isValid = validateWebhookSignature(
        rawBodyString,
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

    const payload = JSON.parse(rawBody.toString());
    const event = payload.event as string;

    this.logger.log(`Razorpay webhook: ${event}`);

    if (event === 'payment.captured') {
      const paymentEntity =
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

    return { received: true };
  }

  private async handlePaymentCaptured(paymentEntity: any) {
    const orderId = paymentEntity.order_id as string;
    const razorpayPaymentId = paymentEntity.id as string;

    if (!orderId || !razorpayPaymentId) {
      this.logger.warn(
        `Razorpay webhook: missing order_id or payment id in entity`,
      );
      return null;
    }

    const payment = await this.paymentRepository.findOne({
      where: { razorpayOrderId: orderId },
    });

    if (!payment) {
      this.logger.warn(`No payment found for order ${orderId}`);
      return null;
    }

    if (payment.status === PaymentStatus.PAID) {
      this.logger.log(`Order ${orderId} already processed — skipping`);
      return payment;
    }

    payment.razorpayPaymentId = razorpayPaymentId;
    payment.status = PaymentStatus.PAID;
    const saved = await this.paymentRepository.save(payment);
    this.logger.log(
      `Payment captured: ${razorpayPaymentId} for order ${orderId}`,
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
      where: { razorpayOrderId: orderId },
    });
  }

  /** Public order status for polling: status + queue item when paid (so frontend can show success without relying only on webhook). */
  async getOrderStatus(orderId: string): Promise<{
    status: 'created' | 'paid';
    queueItem?: { id: string; position: number; eta: number };
  }> {
    const payment = await this.findByOrderId(orderId);
    if (!payment) {
      throw new NotFoundException('Order not found');
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
      .where('p.venue_id = :venueId', { venueId })
      .andWhere('p.status = :status', { status: PaymentStatus.PAID });

    if (startDate) qb.andWhere('p.created_at >= :startDate', { startDate });
    if (endDate) qb.andWhere('p.created_at <= :endDate', { endDate });

    const payments = await qb.orderBy('p.created_at', 'DESC').getMany();
    const total = payments.reduce((sum, p) => sum + p.amount, 0);

    return { payments, total, count: payments.length };
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
}
