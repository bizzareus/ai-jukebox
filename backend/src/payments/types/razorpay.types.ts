/**
 * Razorpay webhook and API response types.
 * See https://razorpay.com/docs/webhooks/payload/
 */

export interface RazorpayPaymentEntity {
  id: string;
  order_id: string;
}

export interface RazorpayWebhookPayload {
  event: string;
  payload?: {
    payment?: { entity?: RazorpayPaymentEntity };
    qr_code?: { entity?: { id: string } };
  };
  payment?: { entity?: RazorpayPaymentEntity };
  qr_code?: { entity?: { id: string } };
}

export interface RazorpayOrderCreateResponse {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

export interface RazorpayQrFetchResponse {
  id: string;
  image_url?: string;
  image_content?: string;
}

export interface RazorpayQrFetchPaymentsResponse {
  items?: Array<{ id?: string; status?: string }>;
}
