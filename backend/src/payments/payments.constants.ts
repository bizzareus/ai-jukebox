/** Payments module constants. */

/** QR code validity window (seconds). */
export const QR_CLOSE_BY_SECONDS = 600;

/** Max length for Razorpay receipt field. */
export const RAZORPAY_RECEIPT_MAX_LENGTH = 40;

/** Max length for Razorpay QR name/description. */
export const RAZORPAY_DESCRIPTION_MAX_LENGTH = 255;

/** Number of payments to fetch when syncing QR status from Razorpay. */
export const QR_FETCH_PAYMENTS_COUNT = 10;

/** Timeout for proxying QR image (ms). */
export const PROXY_QR_IMAGE_TIMEOUT_MS = 10_000;
