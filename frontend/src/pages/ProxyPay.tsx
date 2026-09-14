import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { CheckCircle, IndianRupee, Loader2, XCircle } from 'lucide-react';
import { api } from '../services/api';

interface ProxyPublic {
  id: string;
  amount: number;
  description: string | null;
  referenceId: string | null;
  status: 'created' | 'paid' | 'failed';
  razorpayOrderId: string | null;
  razorpayKeyId?: string;
  upiString?: string;
  customerName: string | null;
  customerMobile: string | null;
  customerEmail: string | null;
}

interface ProxyStatus {
  status: 'created' | 'paid' | 'failed';
  amount: number;
  referenceId: string | null;
  razorpayPaymentId: string | null;
  razorpayOrderId: string | null;
  redirectUrl: string;
}

function loadRazorpayCheckout(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
    document.head.appendChild(script);
  });
}

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

/** 10-digit Indian mobile → +91 format for Razorpay prefill. */
function formatContactForRazorpay(mobile: string | null | undefined): string | undefined {
  if (!mobile || typeof mobile !== 'string') return undefined;
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return digits.length >= 10 ? `+91${digits.slice(-10)}` : undefined;
}

export default function ProxyPay() {
  const { id } = useParams<{ id: string }>();
  const [info, setInfo] = useState<ProxyPublic | null>(null);
  const [status, setStatus] = useState<ProxyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [upiString, setUpiString] = useState<string | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const intentOpenedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    pollRef.current = null;
    timeoutRef.current = null;
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  // Load payment-link details, then fetch the UPI intent string.
  // The page's only job is opening the intent: it auto-opens on load and
  // offers QR + retry CTA as fallback (desktop / blocked navigation).
  useEffect(() => {
    if (!id) {
      setError('Invalid payment link.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<ProxyPublic>(`/proxy-payments/${encodeURIComponent(id)}`);
        if (cancelled) return;
        setInfo(res);
        if (res.status === 'paid') {
          const st = await api.get<ProxyStatus>(
            `/proxy-payments/${encodeURIComponent(id)}/status`,
          );
          if (cancelled) return;
          setStatus(st);
        } else if (res.upiString) {
          setUpiString(res.upiString);
        } else {
          try {
            const qr = await api.post<{ upiString: string }>(
              `/proxy-payments/${encodeURIComponent(id)}/ensure-qr`,
              {},
            );
            if (!cancelled && qr?.upiString) setUpiString(qr.upiString);
          } catch {
            // QR unavailable — checkout fallback below stays available.
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Payment link not found.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Auto-open the UPI intent once (mobile app switch). Desktop/no-handler
  // falls through to the QR + retry CTA below.
  useEffect(() => {
    if (!upiString || intentOpenedRef.current) return;
    intentOpenedRef.current = true;
    window.location.assign(upiString);
  }, [upiString]);

  // Draw the UPI QR for scan-and-pay fallback.
  useEffect(() => {
    if (!upiString) return;
    const raf = requestAnimationFrame(() => {
      if (qrCanvasRef.current) {
        QRCode.toCanvas(qrCanvasRef.current, upiString, {
          width: 220,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' },
        });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [upiString]);

  // Poll status after checkout is opened (webhook / UPI intent fallback)
  const startPolling = useCallback(() => {
    if (!id || pollRef.current) return;
    const poll = async () => {
      try {
        const st = await api.get<ProxyStatus>(
          `/proxy-payments/${encodeURIComponent(id)}/status`,
        );
        setStatus(st);
        if (st.status === 'paid') {
          stopPolling();
          setRedirecting(true);
          window.setTimeout(() => {
            window.location.assign(st.redirectUrl);
          }, 1800);
        }
      } catch {
        // ignore transient errors
      }
    };
    void poll();
    pollRef.current = setInterval(() => void poll(), POLL_INTERVAL_MS);
    timeoutRef.current = setTimeout(stopPolling, POLL_TIMEOUT_MS);
  }, [id, stopPolling]);

  // If already paid on load, redirect straight away
  useEffect(() => {
    if (status?.status === 'paid' && !redirecting) {
      setRedirecting(true);
      const t = window.setTimeout(() => window.location.assign(status.redirectUrl), 1800);
      return () => window.clearTimeout(t);
    }
  }, [status, redirecting]);

  const handlePay = async () => {
    if (!id || !info) return;
    setError(null);
    setPaying(true);
    try {
      let orderId = info.razorpayOrderId;
      let keyId = info.razorpayKeyId;
      if (!orderId || !keyId) {
        const ensured = await api.post<{ razorpayOrderId: string; razorpayKeyId: string }>(
          `/proxy-payments/${encodeURIComponent(id)}/ensure-order`,
          {},
        );
        orderId = ensured.razorpayOrderId;
        keyId = ensured.razorpayKeyId;
      }
      await loadRazorpayCheckout();
      if (!window.Razorpay || !orderId || !keyId) throw new Error('Payment gateway unavailable');

      const rzp = new window.Razorpay({
        key: keyId,
        order_id: orderId,
        amount: info.amount * 100,
        currency: 'INR',
        name: 'Muzobox',
        description: info.description ?? (info.referenceId ? `Ref: ${info.referenceId}` : 'Payment'),
        // Prefill whichever contact details the source site collected.
        ...(() => {
          const contact = formatContactForRazorpay(info.customerMobile);
          const email = info.customerEmail?.trim() || undefined;
          const name = info.customerName?.trim() || undefined;
          return contact || email || name
            ? {
                prefill: {
                  ...(contact ? { contact } : {}),
                  ...(email ? { email } : {}),
                  ...(name ? { name } : {}),
                },
              }
            : {};
        })(),
        theme: { color: '#7c2d12' },
        modal: { ondismiss: () => setPaying(false) },
        handler: async (response: unknown) => {
          try {
            const r = response as {
              razorpay_payment_id: string;
              razorpay_order_id: string;
              razorpay_signature: string;
            };
            // Instant verify → marks PAID without waiting for webhook
            const st = await api.post<ProxyStatus>(
              `/proxy-payments/${encodeURIComponent(id)}/verify`,
              {
                razorpay_payment_id: r.razorpay_payment_id,
                razorpay_order_id: r.razorpay_order_id,
                razorpay_signature: r.razorpay_signature,
              },
            );
            setStatus(st);
            setPaying(false);
            setRedirecting(true);
            window.setTimeout(() => window.location.assign(st.redirectUrl), 1800);
          } catch (e) {
            // Verify failed (or already handled) — fall back to polling the webhook path
            startPolling();
            setPaying(false);
            setError(e instanceof Error ? e.message : null);
          }
        },
      });
      rzp.open();
      startPolling();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open payment gateway.');
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-5">
        <div className="max-w-sm w-full bg-surface-card border border-surface-border rounded-2xl p-6 text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h1 className="font-display text-lg font-bold text-stone-900">Invalid payment link</h1>
          <p className="text-stone-500 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const paid = status?.status === 'paid';

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-5 py-10">
      <div className="max-w-sm w-full bg-surface-card border border-surface-border rounded-2xl p-6 shadow-sm">
        <div className="text-center mb-5">
          <p className="text-stone-500 text-xs uppercase tracking-wide">Secure payment</p>
          <div className="flex items-center justify-center gap-1 mt-2 text-stone-900">
            <IndianRupee className="w-6 h-6 text-brand-600" />
            <span className="font-display text-4xl font-bold">{info?.amount}</span>
          </div>
          {info?.referenceId && (
            <p className="text-stone-500 text-xs mt-2">Ref: {info.referenceId}</p>
          )}
          {info?.description && (
            <p className="text-stone-600 text-sm mt-1">{info.description}</p>
          )}
        </div>

        {paid && status ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle className="w-14 h-14 text-green-500" />
            <p className="text-stone-900 font-semibold">Payment successful!</p>
            <p className="text-stone-500 text-sm text-center">
              {redirecting ? 'Taking you back to complete your booking…' : 'Confirmed.'}
            </p>
            <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
            <button
              type="button"
              onClick={() => window.location.assign(status.redirectUrl)}
              className="text-brand-600 text-sm font-medium underline mt-1"
            >
              Continue now
            </button>
          </div>
        ) : (
          <>
            {upiString ? (
              <>
                <a
                  href={upiString}
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.assign(upiString);
                  }}
                  aria-label="Open UPI app to pay"
                  className="mx-auto block w-fit cursor-pointer rounded-2xl border-2 border-stone-200 bg-white p-1 transition-colors hover:border-stone-300 active:opacity-90"
                >
                  <canvas ref={qrCanvasRef} className="block rounded-xl" />
                </a>
                <p className="mt-3 text-center text-sm text-stone-500">
                  Opening your UPI app… or scan the QR
                </p>
                <button
                  type="button"
                  onClick={() => window.location.assign(upiString)}
                  className="mt-3 w-full rounded-xl bg-brand-600 px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand-700"
                >
                  Pay via UPI
                </button>
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={paying}
                  className="mt-2 w-full rounded-xl px-4 py-2 text-sm font-medium text-brand-600 underline disabled:opacity-60"
                >
                  {paying ? 'Opening payment…' : 'More payment options'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={paying}
                  className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold rounded-xl px-4 py-3.5 text-base transition-colors flex items-center justify-center gap-2"
                >
                  {paying ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Opening payment…
                    </>
                  ) : (
                    <>
                      <IndianRupee className="w-5 h-5" />
                      Pay ₹{info?.amount}
                    </>
                  )}
                </button>
              </>
            )}
            <div className="mt-4 flex items-center justify-center gap-1.5 text-stone-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-xs">Waiting for payment confirmation…</span>
            </div>
            {error && <p className="text-red-500 text-xs text-center mt-3">{error}</p>}
            {info?.description?.startsWith('Chart alert') && (
              <p className="text-stone-500 text-xs text-center mt-3">
                100% guaranteed refund if full confirmed ticket not found
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
