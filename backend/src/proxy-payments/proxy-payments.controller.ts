import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { ProxyPaymentsService } from './proxy-payments.service';
import {
  CreateProxyPaymentDto,
  VerifyProxyPaymentDto,
} from './dto/create-proxy-payment.dto';

@Controller('proxy-payments')
export class ProxyPaymentsController {
  constructor(
    private readonly proxy: ProxyPaymentsService,
    private readonly config: ConfigService,
  ) {}

  /** lastberth backend → muzobox. Requires x-api-key when PROXY_PAYMENTS_API_KEY is set. */
  private assertApiKey(apiKey: string | undefined): void {
    const expected = this.config.get<string>('PROXY_PAYMENTS_API_KEY')?.trim();
    if (!expected) return; // dev mode: open
    if (!apiKey || apiKey !== expected) {
      throw new UnauthorizedException('Invalid API key');
    }
  }

  /**
   * Create a payment link.
   * Body: { amount, redirectUri, referenceId?, callbackUrl?, customerName?, customerMobile?, customerEmail?, description? }
   * Returns: { id, amount, payUrl, razorpayOrderId?, razorpayKeyId? }
   * Send `payUrl` to the customer (SMS/WhatsApp/link). It opens Razorpay Checkout.
   */
  @Post('create-link')
  createLink(
    @Body() dto: CreateProxyPaymentDto,
    @Headers('x-api-key') apiKey: string | undefined,
  ) {
    this.assertApiKey(apiKey);
    return this.proxy.createLink(dto);
  }

  /** Razorpay webhook for proxy orders. Configure in Razorpay Dashboard → Webhooks. */
  @Post('webhook')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string | undefined,
  ) {
    return this.proxy.handleWebhook(req.rawBody, signature);
  }

  /** Public: payment-link details for the hosted `/pay/:id` page. */
  @Get(':id')
  getOne(@Param('id') id: string) {
    if (!id?.trim()) throw new BadRequestException('id is required');
    return this.proxy.getPublic(id.trim());
  }

  /** Public: (re)create the Razorpay order if the page needs it. */
  @Post(':id/ensure-order')
  ensureOrder(@Param('id') id: string) {
    if (!id?.trim()) throw new BadRequestException('id is required');
    return this.proxy.ensureOrder(id.trim());
  }

  /** Public: (re)create the UPI QR intent string if the page needs it. */
  @Post(':id/ensure-qr')
  ensureQr(@Param('id') id: string) {
    if (!id?.trim()) throw new BadRequestException('id is required');
    return this.proxy.ensureQr(id.trim());
  }

  /**
   * Public: pollable status + final redirect URL.
   * lastberth backend can also use this server-to-server to verify payment.
   */
  @Get(':id/status')
  getStatus(@Param('id') id: string) {
    if (!id?.trim()) throw new BadRequestException('id is required');
    return this.proxy.getStatus(id.trim());
  }

  /** Public: final `https://lastberth.com/{redirectUri}?…` URL. */
  @Get(':id/redirect-url')
  getRedirectUrl(@Param('id') id: string) {
    if (!id?.trim()) throw new BadRequestException('id is required');
    return this.proxy.getRedirectUrl(id.trim());
  }

  /** Public: verify Razorpay Checkout signature → mark PAID instantly. */
  @Post(':id/verify')
  verify(
    @Param('id') id: string,
    @Body() dto: VerifyProxyPaymentDto,
  ) {
    if (!id?.trim()) throw new BadRequestException('id is required');
    return this.proxy.verifyCheckoutSignature(
      id.trim(),
      dto.razorpay_payment_id,
      dto.razorpay_order_id,
      dto.razorpay_signature,
    );
  }
}
