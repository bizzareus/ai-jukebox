import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';
import { validateWebhookSignature } from 'razorpay/dist/utils/razorpay-utils';
import { ProxyPayment, ProxyPaymentStatus } from './proxy-payment.entity';
import { CreateProxyPaymentDto } from './dto/create-proxy-payment.dto';
import {
  QR_CLOSE_BY_SECONDS,
  QR_FETCH_PAYMENTS_COUNT,
  RAZORPAY_DESCRIPTION_MAX_LENGTH,
  RAZORPAY_RECEIPT_MAX_LENGTH,
} from '../payments/payments.constants';
import type {
  RazorpayOrderCreateResponse,
  RazorpayQrFetchPaymentsResponse,
  RazorpayQrFetchResponse,
} from '../payments/types/razorpay.types';

export interface ProxyPaymentCreateResult {
  id: string;
  amount: number;
  /** Hosted payment page on muzobox. Open Razorpay Checkout lives here. */
  payUrl: string;
  redirectUri: string;
  referenceId?: string;
  razorpayOrderId?: string;
  razorpayKeyId?: string;
  /** UPI intent string for the Razorpay UPI QR (scan / Pay via UPI). */
  upiString?: string;
  /** Official Razorpay QR image URL (rzp.io). */
  qrImageUrl?: string;
}

export interface ProxyPaymentPublic {
  id: string;
  amount: number;
  description: string | null;
  referenceId: string | null;
  status: ProxyPaymentStatus;
  razorpayOrderId: string | null;
  razorpayKeyId?: string;
  /** UPI intent string for the Razorpay UPI QR (scan / Pay via UPI). */
  upiString?: string;
  /** Official Razorpay QR image URL (rzp.io). */
  qrImageUrl?: string;
  /** Contact details from the source site, for Razorpay Checkout prefill. */
  customerName: string | null;
  customerMobile: string | null;
  customerEmail: string | null;
}

export interface ProxyPaymentStatusResult {
  status: ProxyPaymentStatus;
  amount: number;
  referenceId: string | null;
  razorpayPaymentId: string | null;
  razorpayOrderId: string | null;
  /** Final lastberth.com URL (with payment params). Present once known. */
  redirectUrl: string;
}

export interface ProxyPaymentRefundResult {
  status: 'refunded' | 'already_refunded';
  amount: number;
  referenceId: string | null;
  razorpayPaymentId: string | null;
  razorpayRefundId: string;
  refundedAt: Date;
}

const CALLBACK_TIMEOUT_MS = 10_000;

@Injectable()
export class ProxyPaymentsService {
  private readonly logger = new Logger(ProxyPaymentsService.name);
  private readonly razorpay: Razorpay;

  constructor(
    @InjectRepository(ProxyPayment)
    private readonly repo: Repository<ProxyPayment>,
    private readonly config: ConfigService,
  ) {
    this.razorpay = new Razorpay({
      key_id: this.config.get<string>('RAZORPAY_KEY_ID'),
      key_secret: this.config.get<string>('RAZORPAY_KEY_SECRET'),
    });
  }

  // ─── Create ──────────────────────────────────────────────────────────

  async createLink(
    dto: CreateProxyPaymentDto,
  ): Promise<ProxyPaymentCreateResult> {
    const redirectUri = this.sanitizeRedirectUri(dto.redirectUri);
    const callbackUrl = dto.callbackUrl?.trim() || null;
    if (callbackUrl) this.assertCallbackUrlAllowed(callbackUrl);

    const payment = this.repo.create({
      amount: dto.amount,
      redirectUri,
      callbackUrl,
      referenceId: dto.referenceId?.trim() || null,
      customerName: dto.customerName?.trim() || null,
      customerMobile: dto.customerMobile?.trim() || null,
      customerEmail: dto.customerEmail?.trim() || null,
      description: dto.description?.trim() || null,
      status: ProxyPaymentStatus.CREATED,
    });
    const saved = await this.repo.save(payment);

    const razorpayOrderId = await this.ensureRazorpayOrder(saved);
    // Best-effort: the pay page prefers the UPI QR and falls back to
    // Razorpay Checkout when QR creation is unavailable.
    const upiString = await this.ensureRazorpayQr(saved);

    this.logger.log(
      `Proxy payment ${saved.id} created: ₹${saved.amount} ref=${saved.referenceId ?? 'n/a'} → ${this.buildPayUrl(saved.id)}`,
    );

    const keyId = this.config.get<string>('RAZORPAY_KEY_ID') ?? undefined;
    return {
      id: saved.id,
      amount: saved.amount,
      payUrl: this.buildPayUrl(saved.id),
      redirectUri: saved.redirectUri,
      referenceId: saved.referenceId ?? undefined,
      razorpayOrderId: razorpayOrderId ?? undefined,
      razorpayKeyId: keyId,
      upiString: upiString || undefined,
      qrImageUrl: saved.qrImageUrl ?? undefined,
    };
  }

  // ─── Read / status ───────────────────────────────────────────────────

  async getPublic(id: string): Promise<ProxyPaymentPublic> {
    const payment = await this.findOrThrow(id);
    return this.toPublic(payment, await this.fetchQrContent(payment));
  }

  /** Public: (re)create the UPI QR content if the page needs it. */
  async ensureQr(
    id: string,
  ): Promise<{ upiString: string; qrImageUrl?: string }> {
    const payment = await this.findOrThrow(id);
    const upiString = await this.ensureRazorpayQr(payment);
    if (!upiString && !payment.qrImageUrl) {
      throw new BadRequestException('Could not create UPI QR');
    }
    return { upiString, qrImageUrl: payment.qrImageUrl ?? undefined };
  }

  async ensureOrder(
    id: string,
  ): Promise<{ razorpayOrderId: string; razorpayKeyId: string }> {
    const payment = await this.findOrThrow(id);
    const orderId = await this.ensureRazorpayOrder(payment);
    if (!orderId) {
      throw new BadRequestException('Could not create Razorpay order');
    }
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    if (!keyId) throw new BadRequestException('Payments not configured');
    return { razorpayOrderId: orderId, razorpayKeyId: keyId };
  }

  /**
   * Status for polling + server-to-server verification by lastberth.
   * Opportunistically syncs from Razorpay so polling succeeds even
   * if the webhook has not arrived yet.
   */
  async getStatus(id: string): Promise<ProxyPaymentStatusResult> {
    const payment = await this.findOrThrow(id);
    if (payment.status !== ProxyPaymentStatus.PAID) {
      await this.syncFromRazorpay(payment);
    }
    const fresh = await this.findOrThrow(id);
    return {
      status: fresh.status,
      amount: fresh.amount,
      referenceId: fresh.referenceId,
      razorpayPaymentId: fresh.razorpayPaymentId,
      razorpayOrderId: fresh.razorpayOrderId,
      redirectUrl: this.buildRedirectUrl(fresh),
    };
  }

  async getRedirectUrl(
    id: string,
  ): Promise<{ redirectUrl: string; status: ProxyPaymentStatus }> {
    const payment = await this.findOrThrow(id);
    return {
      redirectUrl: this.buildRedirectUrl(payment),
      status: payment.status,
    };
  }

  // ─── Refund (lastberth automated refunds) ──────────────────────────

  /**
   * Refund a PAID proxy payment via Razorpay. Idempotent: a payment that
   * already has `razorpayRefundId` returns `already_refunded` without
   * calling Razorpay again.
   */
  async refundPayment(
    id: string,
    opts?: { amount?: number; reason?: string; referenceId?: string },
  ): Promise<ProxyPaymentRefundResult> {
    const payment = await this.findOrThrow(id);
    if (payment.status !== ProxyPaymentStatus.PAID) {
      throw new BadRequestException('Only PAID payments can be refunded');
    }
    if (!payment.razorpayPaymentId) {
      throw new BadRequestException('No Razorpay payment id recorded');
    }
    if (payment.razorpayRefundId) {
      return {
        status: 'already_refunded',
        amount: payment.refundAmount ?? payment.amount,
        referenceId: payment.referenceId,
        razorpayPaymentId: payment.razorpayPaymentId,
        razorpayRefundId: payment.razorpayRefundId,
        refundedAt: payment.refundedAt ?? payment.updatedAt,
      };
    }

    const amount = opts?.amount ?? payment.amount;
    if (!Number.isInteger(amount) || amount < 1 || amount > payment.amount) {
      throw new BadRequestException('Refund amount must cover 1..paid amount');
    }
    const reason =
      opts?.reason?.trim().slice(0, 500) || 'chart_no_full_journey';

    try {
      const refund = (await this.razorpay.payments.refund(
        payment.razorpayPaymentId,
        {
          amount: amount * 100,
          notes: {
            proxy_payment_id: payment.id,
            reference_id:
              opts?.referenceId?.trim() || payment.referenceId || '',
            reason,
          },
        },
      )) as unknown as { id?: string };
      if (!refund?.id) throw new Error('Empty refund response from Razorpay');

      payment.refundStatus = 'succeeded';
      payment.razorpayRefundId = refund.id;
      payment.refundAmount = amount;
      payment.refundReason = reason;
      payment.refundedAt = new Date();
      payment.refundError = null;
      await this.repo.save(payment);
      this.logger.log(
        `Proxy payment ${payment.id} refunded ${refund.id} ₹${amount} (${reason})`,
      );
      return {
        status: 'refunded',
        amount,
        referenceId: payment.referenceId,
        razorpayPaymentId: payment.razorpayPaymentId,
        razorpayRefundId: refund.id,
        refundedAt: payment.refundedAt,
      };
    } catch (err) {
      const detail =
        (err as { error?: unknown; message?: string })?.error ??
        (err as Error)?.message ??
        String(err);
      payment.refundStatus = 'failed';
      payment.refundError = JSON.stringify(detail).slice(0, 1000);
      await this.repo.save(payment);
      this.logger.warn(
        `Proxy refund failed for ${payment.id}: ${payment.refundError}`,
      );
      throw new BadRequestException('Refund failed, please retry');
    }
  }

  // ─── Checkout verify (instant, no webhook wait) ──────────────────────

  async verifyCheckoutSignature(
    id: string,
    razorpayPaymentId: string,
    razorpayOrderId: string,
    razorpaySignature: string,
  ): Promise<ProxyPaymentStatusResult> {
    const payment = await this.findOrThrow(id);
    if (
      !payment.razorpayOrderId ||
      payment.razorpayOrderId !== razorpayOrderId
    ) {
      throw new BadRequestException(
        'Order id does not match this payment link',
      );
    }
    const secret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!secret) throw new BadRequestException('Payments not configured');

    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');
    if (expected !== razorpaySignature) {
      this.logger.warn(`Proxy payment ${id}: checkout signature mismatch`);
      throw new BadRequestException('Invalid payment signature');
    }
    await this.markPaid(
      payment,
      razorpayPaymentId,
      `checkout verify ${razorpayPaymentId}`,
    );
    return this.getStatus(id);
  }

  // ─── Webhook ─────────────────────────────────────────────────────────

  async handleWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ) {
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      throw new BadRequestException('Webhook body required');
    }
    if (!signature?.trim()) {
      throw new BadRequestException('Missing x-razorpay-signature header');
    }
    const secret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!secret) throw new BadRequestException('Webhook not configured');

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString());
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }
    const bodyForValidation = (
      payload?.event as string | undefined
    )?.startsWith('qr_code.')
      ? JSON.stringify(payload).replace(/\//g, '\\/')
      : rawBody.toString();
    let valid = false;
    try {
      valid = validateWebhookSignature(
        bodyForValidation,
        signature.trim(),
        secret,
      );
    } catch {
      valid = false;
    }
    if (!valid) {
      this.logger.warn('Proxy webhook: signature mismatch');
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = payload?.event as string | undefined;
    this.logger.log(`Proxy webhook: ${event}`);
    if (event === 'payment.captured' || event === 'order.paid') {
      const entity =
        payload?.payload?.payment?.entity ?? payload?.payment?.entity;
      const orderId: string | undefined =
        entity?.order_id ?? payload?.payload?.order?.entity?.id;
      const paymentId: string | undefined = entity?.id;
      if (orderId && paymentId) {
        await this.markPaidByRazorpayOrder(
          orderId,
          paymentId,
          `webhook ${event}`,
        );
      } else {
        this.logger.warn('Proxy webhook: missing order_id/payment id');
      }
    }

    if (event === 'qr_code.credited') {
      const qrEntity =
        payload?.payload?.qr_code?.entity ?? payload?.qr_code?.entity;
      const qrId: string | undefined = qrEntity?.id;
      const paymentEntity =
        payload?.payload?.payment?.entity ?? payload?.payment?.entity;
      if (!qrId) {
        this.logger.warn('Proxy webhook: qr_code entity missing');
      } else {
        const payment = await this.repo.findOne({
          where: { razorpayQrId: qrId },
        });
        if (!payment) {
          this.logger.warn(`Proxy webhook: no payment for QR ${qrId}`);
        } else {
          await this.markPaid(
            payment,
            paymentEntity?.id ?? `qr_${qrId}`,
            `qr_code.credited ${qrId}`,
          );
        }
      }
    }
    return { received: true };
  }

  /**
   * Called by the main payments webhook as a fallback (single webhook URL setup).
   * Matches checkout orders and UPI QR ids (QR payments report order_id = qr id).
   */
  async markPaidByRazorpayOrder(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    context: string,
  ) {
    const payment = await this.repo.findOne({
      where: [{ razorpayOrderId }, { razorpayQrId: razorpayOrderId }],
    });
    if (!payment) return null;
    return this.markPaid(payment, razorpayPaymentId, context);
  }

  // ─── Internals ───────────────────────────────────────────────────────

  private async findOrThrow(id: string): Promise<ProxyPayment> {
    const payment = await this.repo.findOne({ where: { id } });
    if (!payment) throw new NotFoundException('Payment link not found');
    return payment;
  }

  private toPublic(p: ProxyPayment, upiString?: string): ProxyPaymentPublic {
    return {
      id: p.id,
      amount: p.amount,
      description: p.description,
      referenceId: p.referenceId,
      status: p.status,
      razorpayOrderId: p.razorpayOrderId,
      razorpayKeyId: this.config.get<string>('RAZORPAY_KEY_ID') ?? undefined,
      upiString: upiString || undefined,
      qrImageUrl: p.qrImageUrl ?? undefined,
      customerName: p.customerName,
      customerMobile: p.customerMobile,
      customerEmail: p.customerEmail,
    };
  }

  private async ensureRazorpayOrder(
    payment: ProxyPayment,
  ): Promise<string | null> {
    if (payment.razorpayOrderId) return payment.razorpayOrderId;
    try {
      const order = (await this.razorpay.orders.create({
        amount: payment.amount * 100,
        currency: 'INR',
        receipt: `px_${payment.id}`.slice(0, RAZORPAY_RECEIPT_MAX_LENGTH),
        notes: {
          proxy_payment_id: payment.id,
          reference_id: payment.referenceId ?? '',
          redirect_uri: payment.redirectUri,
        },
      })) as unknown as RazorpayOrderCreateResponse;
      if (order?.id) {
        payment.razorpayOrderId = order.id;
        await this.repo.save(payment);
        this.logger.log(
          `Proxy payment ${payment.id}: Razorpay order ${order.id}`,
        );
        return order.id;
      }
    } catch (err) {
      // Razorpay SDK failures are plain objects ({ statusCode, error: { code,
      // description } }), not Errors — String(err) renders "[object Object".
      const detail = err as {
        statusCode?: number;
        response?: { data?: unknown };
        error?: unknown;
        message?: string;
      };
      this.logger.warn(
        `Razorpay order creation failed for proxy payment ${payment.id}: ` +
          JSON.stringify(
            detail?.response?.data ??
              detail?.error ??
              detail?.message ??
              String(err),
          ),
      );
    }
    return null;
  }

  /** Poll Razorpay for captured payments (fallback when webhook is delayed). */
  private async syncFromRazorpay(payment: ProxyPayment): Promise<void> {
    if (payment.razorpayOrderId) {
      try {
        const ordersApi = this.razorpay.orders as unknown as {
          fetchPayments: (
            orderId: string,
          ) => Promise<{ items?: Array<{ id?: string; status?: string }> }>;
        };
        const res = await ordersApi.fetchPayments(payment.razorpayOrderId);
        const captured = res?.items?.find(
          (p) => p.status === 'captured' && p.id,
        );
        if (captured?.id) {
          await this.markPaid(
            payment,
            captured.id,
            `order fetch ${captured.id}`,
          );
          return;
        }
      } catch (err) {
        this.logger.warn(
          `Proxy sync failed for ${payment.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    // QR path: no checkout order — look for captured payments on the QR itself.
    if (payment.status !== ProxyPaymentStatus.PAID && payment.razorpayQrId) {
      try {
        const res = (await this.razorpay.qrCode.fetchAllPayments(
          payment.razorpayQrId,
          { count: QR_FETCH_PAYMENTS_COUNT },
        )) as RazorpayQrFetchPaymentsResponse;
        const captured = res?.items?.find((p) => p.status === 'captured');
        if (captured && typeof captured.id === 'string') {
          await this.markPaid(
            payment,
            captured.id,
            `QR ${payment.razorpayQrId} payment detected via fetch`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Proxy QR sync failed for ${payment.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  /**
   * Create (once) the single-use Razorpay UPI QR and return its intent string
   * (`upi://pay?...`) for scan / Pay-via-UPI flows. Best-effort: returns ''
   * when Razorpay is unavailable so callers can fall back to Checkout.
   */
  private async ensureRazorpayQr(payment: ProxyPayment): Promise<string> {
    try {
      if (!payment.razorpayQrId) {
        const closeBy = Math.floor(Date.now() / 1000) + QR_CLOSE_BY_SECONDS;
        const qr = (await this.razorpay.qrCode.create({
          type: 'upi_qr',
          name: `Muzobox ${payment.amount}`.slice(
            0,
            RAZORPAY_DESCRIPTION_MAX_LENGTH,
          ),
          usage: 'single_use',
          fixed_amount: true,
          payment_amount: payment.amount * 100,
          description: (
            payment.description ??
            (payment.referenceId ? `Ref: ${payment.referenceId}` : 'Payment')
          ).slice(0, RAZORPAY_DESCRIPTION_MAX_LENGTH),
          close_by: closeBy,
        } as Parameters<Razorpay['qrCode']['create']>[0])) as unknown as {
          id?: string;
          image_url?: string;
          image_content?: string;
        };
        if (!qr?.id) return '';
        payment.razorpayQrId = qr.id;
        if (qr.image_url) {
          payment.qrImageUrl = qr.image_url;
        }
        await this.repo.save(payment);
        this.logger.log(
          `Proxy payment ${payment.id}: Razorpay QR ${qr.id} (image: ${payment.qrImageUrl ?? 'none'})`,
        );
      }
      return this.fetchQrContent(payment);
    } catch (err) {
      this.logger.warn(
        `Proxy QR creation failed for ${payment.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return '';
    }
  }

  /** UPI intent string for an existing QR id ('' when unavailable). */
  private async fetchQrContent(payment: ProxyPayment): Promise<string> {
    if (!payment.razorpayQrId) return '';
    try {
      const fetched = (await this.razorpay.qrCode.fetch(
        payment.razorpayQrId,
      )) as unknown as RazorpayQrFetchResponse;
      if (fetched?.image_url && !payment.qrImageUrl) {
        payment.qrImageUrl = fetched.image_url;
        await this.repo.save(payment);
      }
      return fetched?.image_content ?? '';
    } catch (err) {
      this.logger.warn(
        `Could not fetch QR content for ${payment.razorpayQrId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return '';
    }
  }

  private async markPaid(
    payment: ProxyPayment,
    razorpayPaymentId: string,
    context: string,
  ): Promise<ProxyPayment> {
    if (payment.status === ProxyPaymentStatus.PAID) {
      if (!payment.razorpayPaymentId && razorpayPaymentId) {
        payment.razorpayPaymentId = razorpayPaymentId;
        await this.repo.save(payment);
      }
      return payment;
    }
    payment.razorpayPaymentId = razorpayPaymentId;
    payment.status = ProxyPaymentStatus.PAID;
    const saved = await this.repo.save(payment);
    this.logger.log(`Proxy payment ${saved.id} PAID (${context})`);
    // Fire-and-forget proxy to lastberth's API.
    void this.forwardToCallback(saved);
    return saved;
  }

  // ─── URLs ────────────────────────────────────────────────────────────

  buildPayUrl(id: string): string {
    const frontend = (this.config.get<string>('FRONTEND_URL') ?? '')
      .split(',')[0]
      ?.trim()
      .replace(/\/$/, '');
    if (!frontend) return `/pay/${id}`;
    return `${frontend}/pay/${id}`;
  }

  lastberthBaseUrl(): string {
    const base = (
      this.config.get<string>('LASTBERTH_BASE_URL') ?? 'https://lastberth.com'
    )
      .trim()
      .replace(/\/$/, '');
    return base || 'https://lastberth.com';
  }

  /**
   * Final browser redirect: lastberth.com/{redirectUri} + payment params.
   * Existing query params in redirectUri are preserved.
   */
  buildRedirectUrl(p: ProxyPayment): string {
    const base = this.lastberthBaseUrl();
    const path = p.redirectUri.replace(/^\/+/, '');
    const sep = path.includes('?') ? '&' : '?';
    const params = new URLSearchParams({
      paymentId: p.id,
      status: p.status,
      amount: String(p.amount),
    });
    if (p.referenceId) params.set('referenceId', p.referenceId);
    if (p.razorpayPaymentId)
      params.set('razorpay_payment_id', p.razorpayPaymentId);
    if (p.razorpayOrderId) params.set('razorpay_order_id', p.razorpayOrderId);
    return `${base}/${path}${sep}${params.toString()}`;
  }

  /**
   * Accept a relative path (`a/b?x=1`, `/a/b?x=1`). Also accept an absolute
   * lastberth URL and normalize it to a relative path. Reject everything else
   * (open-redirect protection: muzobox must only redirect to lastberth).
   */
  private sanitizeRedirectUri(input: string): string {
    const raw = input.trim();
    if (!raw) throw new BadRequestException('redirectUri must not be empty');
    if (raw.startsWith('//'))
      throw new BadRequestException(
        'redirectUri must be a relative path on lastberth.com',
      );
    if (/^https?:\/\//i.test(raw)) {
      let parsed: URL;
      try {
        parsed = new URL(raw);
      } catch {
        throw new BadRequestException(
          'redirectUri must be a valid path or lastberth.com URL',
        );
      }
      const baseHost = this.hostOf(this.lastberthBaseUrl());
      const host = parsed.hostname.toLowerCase();
      const allowed =
        host === baseHost ||
        host === 'lastberth.com' ||
        host.endsWith('.lastberth.com');
      if (!allowed) {
        throw new BadRequestException(
          'redirectUri must point to lastberth.com',
        );
      }
      const rel = `${parsed.pathname}${parsed.search}${parsed.hash}`.replace(
        /^\/+/,
        '',
      );
      if (!rel) throw new BadRequestException('redirectUri must not be empty');
      return rel.slice(0, 2000);
    }
    if (/[\s<>"]/.test(raw))
      throw new BadRequestException('redirectUri contains invalid characters');
    return raw.replace(/^\/+/, '').slice(0, 2000);
  }

  private assertCallbackUrlAllowed(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('callbackUrl must be a valid URL');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new BadRequestException('callbackUrl must be http(s)');
    }
  }

  private hostOf(url: string): string {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return 'lastberth.com';
    }
  }

  /** Server-to-server proxy: POST payment result to lastberth's API. */
  private async forwardToCallback(payment: ProxyPayment): Promise<void> {
    if (!payment.callbackUrl) return;
    const payload = {
      paymentId: payment.id,
      status: payment.status,
      amount: payment.amount,
      referenceId: payment.referenceId,
      razorpay_payment_id: payment.razorpayPaymentId,
      razorpay_order_id: payment.razorpayOrderId,
      redirectUrl: this.buildRedirectUrl(payment),
    };
    try {
      await axios.post(payment.callbackUrl, payload, {
        timeout: CALLBACK_TIMEOUT_MS,
      });
      payment.callbackStatus = 'sent';
      this.logger.log(
        `Proxy payment ${payment.id}: callback sent to ${payment.callbackUrl}`,
      );
    } catch (err) {
      payment.callbackStatus = 'failed';
      this.logger.warn(
        `Proxy payment ${payment.id}: callback to ${payment.callbackUrl} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      payment.callbackAttemptedAt = new Date();
      await this.repo.save(payment);
    }
  }
}
