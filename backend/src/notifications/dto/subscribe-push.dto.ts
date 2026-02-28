import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class SubscribePushDto {
  /** For venue admin: subscribe to "new song queued" alerts. */
  @IsOptional()
  @IsUUID()
  venueId?: string;

  /** For customer: subscribe to "your song is playing" (Razorpay order id). */
  @IsOptional()
  @IsString()
  orderId?: string;

  @IsObject()
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
}
