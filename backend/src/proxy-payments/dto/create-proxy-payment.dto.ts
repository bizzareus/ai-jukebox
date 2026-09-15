import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProxyPaymentDto {
  /** Amount in INR (rupees). Charged amount. Min ₹1. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? Number(value) : value,
  )
  @IsInt({ message: 'amount must be an integer (rupees)' })
  @Min(1, { message: 'amount must be at least ₹1' })
  @Max(1000000, { message: 'amount must be at most ₹10,00,000' })
  amount: number;

  /**
   * Where to send the customer after payment, relative to lastberth.com.
   * Examples: `booking-success?bookingId=123`, `/pay/success?order=abc`.
   * The proxy redirects to `https://lastberth.com/{redirectUri}`
   * with `paymentId`, `status`, `amount`, `referenceId`,
   * `razorpay_payment_id`, `razorpay_order_id` appended.
   */
  @IsString()
  @MinLength(1, { message: 'redirectUri must not be empty' })
  @MaxLength(2000)
  redirectUri: string;

  /** lastberth's own reference (booking/order id). Echoed back on redirect. */
  @IsString()
  @IsOptional()
  @MaxLength(255)
  referenceId?: string;

  /**
   * Optional server-to-server webhook. Muzobox POSTs the payment result
   * JSON here after marking PAID (acts as a proxy to this API).
   */
  @IsUrl(
    { require_protocol: true, protocols: ['https', 'http'] },
    { message: 'callbackUrl must be a valid URL' },
  )
  @IsOptional()
  @MaxLength(2000)
  callbackUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  customerName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  customerMobile?: string;

  @IsEmail({}, { message: 'customerEmail must be a valid email' })
  @IsOptional()
  @MaxLength(255)
  customerEmail?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}

export class VerifyProxyPaymentDto {
  @IsString()
  @MinLength(1)
  razorpay_payment_id: string;

  @IsString()
  @MinLength(1)
  razorpay_order_id: string;

  @IsString()
  @MinLength(1)
  razorpay_signature: string;
}

export class RefundProxyPaymentDto {
  /** Amount in INR (rupees). Defaults to full payment amount. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? Number(value) : value,
  )
  @IsInt({ message: 'amount must be an integer (rupees)' })
  @Min(1, { message: 'amount must be at least ₹1' })
  @IsOptional()
  amount?: number;

  /** Reason recorded in logs + Razorpay notes (e.g. chart_no_full_journey). */
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;

  /** lastberth's own reference, echoed in logs. */
  @IsString()
  @IsOptional()
  @MaxLength(255)
  referenceId?: string;
}
