import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ProxyPaymentStatus {
  CREATED = 'created',
  PAID = 'paid',
  FAILED = 'failed',
}

/**
 * Standalone payment link for external sites (e.g. lastberth.com).
 * Muzobox acts as a payment proxy: lastberth creates a link via API,
 * the customer pays on muzobox (`/pay/:id` opens Razorpay Checkout),
 * then the customer is redirected to lastberth.com/{redirectUri}
 * with payment details appended as query params.
 */
@Entity('proxy_payments')
export class ProxyPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Amount in INR (rupees, integer). */
  @Column({ type: 'int' })
  amount: number;

  /**
   * Relative path on lastberth.com to redirect to after payment,
   * e.g. `booking-success?bookingId=123` or `/booking-success?bookingId=123`.
   * The final URL is `${LASTBERTH_BASE_URL}/${redirectUri}` + payment params.
   */
  @Column({ name: 'redirect_uri', type: 'varchar', length: 2000 })
  redirectUri: string;

  /**
   * Optional server-to-server callback. After payment is marked PAID,
   * muzobox POSTs the payment payload here (fire-and-forget).
   */
  @Column({ name: 'callback_url', type: 'varchar', length: 2000, nullable: true })
  callbackUrl: string | null;

  /** lastberth's own reference (booking id, order id, ...). Echoed back. */
  @Column({ name: 'reference_id', type: 'varchar', length: 255, nullable: true })
  referenceId: string | null;

  @Column({ name: 'customer_name', type: 'varchar', length: 255, nullable: true })
  customerName: string | null;

  @Column({ name: 'customer_mobile', type: 'varchar', length: 32, nullable: true })
  customerMobile: string | null;

  @Column({
    name: 'customer_email',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  customerEmail: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: ProxyPaymentStatus,
    default: ProxyPaymentStatus.CREATED,
  })
  status: ProxyPaymentStatus;

  @Column({
    name: 'razorpay_order_id',
    type: 'varchar',
    length: 255,
    unique: true,
    nullable: true,
  })
  razorpayOrderId: string | null;

  @Column({
    name: 'razorpay_payment_id',
    type: 'varchar',
    length: 255,
    unique: true,
    nullable: true,
  })
  razorpayPaymentId: string | null;

  /**
   * Razorpay UPI QR id (upi_qr, single_use) shown on the hosted `/pay/:id`
   * page. QR payments credit via the `qr_code.credited` webhook.
   */
  @Column({
    name: 'razorpay_qr_id',
    type: 'varchar',
    length: 255,
    unique: true,
    nullable: true,
  })
  razorpayQrId: string | null;

  @Column({ name: 'callback_status', type: 'varchar', length: 32, nullable: true })
  callbackStatus: string | null;

  @Column({ name: 'callback_attempted_at', type: 'timestamptz', nullable: true })
  callbackAttemptedAt: Date | null;

  /**
   * Refund tracking for lastberth automated refunds (no full-journey ticket).
   * `refundStatus`: none | initiated | succeeded | failed.
   */
  @Column({ name: 'refund_status', type: 'varchar', length: 32, nullable: true })
  refundStatus: string | null;

  @Column({
    name: 'razorpay_refund_id',
    type: 'varchar',
    length: 255,
    unique: true,
    nullable: true,
  })
  razorpayRefundId: string | null;

  @Column({ name: 'refund_amount', type: 'int', nullable: true })
  refundAmount: number | null;

  @Column({ name: 'refund_reason', type: 'varchar', length: 500, nullable: true })
  refundReason: string | null;

  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  refundedAt: Date | null;

  @Column({ name: 'refund_error', type: 'text', nullable: true })
  refundError: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
