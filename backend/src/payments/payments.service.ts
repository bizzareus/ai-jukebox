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
import * as crypto from 'crypto';
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
      razorpayOrderId: order.id as string,
      amount: venue.pricePerSong,
      status: PaymentStatus.CREATED,
    });

    await this.paymentRepository.save(payment);

    const upiString = this.buildUpiString(
      venue.upiVpa,
      venue.name,
      venue.pricePerSong,
      song.title,
      order.id as string,
    );

    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID') ?? '';
    const testMode = keyId.startsWith('rzp_test_');
    this.logger.log(`Created order ${order.id} for song "${song.title}" at venue ${venue.name}${testMode ? ' (test mode)' : ''}`);

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

  async handleWebhook(rawBody: Buffer, signature: string) {
    const webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET') as string;
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (expectedSig !== signature) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const payload = JSON.parse(rawBody.toString());
    const event = payload.event as string;

    this.logger.log(`Razorpay webhook: ${event}`);

    if (event === 'payment.captured') {
      await this.handlePaymentCaptured(payload.payload.payment.entity);
    }

    return { received: true };
  }

  private async handlePaymentCaptured(paymentEntity: any) {
    const orderId = paymentEntity.order_id as string;
    const razorpayPaymentId = paymentEntity.id as string;

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
    this.logger.log(`Payment captured: ${razorpayPaymentId} for order ${orderId}`);

    // Enqueue the song now that payment is confirmed
    await this.queueService.enqueueFromPayment(saved.id);
    return saved;
  }

  async findByOrderId(orderId: string): Promise<Payment | null> {
    return this.paymentRepository.findOne({ where: { razorpayOrderId: orderId } });
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
    const queueItem = await this.queueService.getQueueItemWithEtaByPaymentId(payment.id);
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
