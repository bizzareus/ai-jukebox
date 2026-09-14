export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
  [key: string]: unknown;
}

export interface RazorpayCheckoutOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name?: string;
  description?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
    [key: string]: unknown;
  };
  modal?: {
    ondismiss?: () => void;
    [key: string]: unknown;
  };
  handler: (response: RazorpaySuccessResponse) => void;
  [key: string]: unknown;
}

export interface RazorpayCheckoutInstance {
  open: () => void;
  on: (event: string, handler: (resp: unknown) => void) => void;
  close?: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

export {};
