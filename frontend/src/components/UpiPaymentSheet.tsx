import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { BottomSheet } from './ui/BottomSheet';
import { Button } from './ui/Button';
import { api } from '../services/api';
import { getSocket, connectSocket } from '../services/socket';
import * as notifications from '../services/notifications';
import type { CreateOrderResponse } from '../types';

interface UpiPaymentSheetProps {
  order: CreateOrderResponse | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (data: QueueConfirmPayload) => void;
  /** When order is null, show form and call this to create order */
  songTitle?: string;
  amount?: number;
  songId?: string;
  venueId?: string;
  onCreateOrder?: (customerName: string, customerMobile: string) => Promise<CreateOrderResponse>;
  /** Name and mobile used for the current order (shown above QR) */
  customerName?: string;
  customerMobile?: string;
}

export interface QueueConfirmPayload {
  queueItem: { id: string; position: number };
  position: number;
  eta: number;
}

const TIMEOUT_MS = 10 * 60 * 1000;
const POLL_INTERVAL_MS = 2000;
const STORAGE_KEY_NAME = 'jukebox_customer_name';
const STORAGE_KEY_MOBILE = 'jukebox_customer_mobile';

function getStoredCustomer(): { name: string; mobile: string } {
  if (typeof window === 'undefined') return { name: '', mobile: '' };
  return {
    name: localStorage.getItem(STORAGE_KEY_NAME) ?? '',
    mobile: localStorage.getItem(STORAGE_KEY_MOBILE) ?? '',
  };
}

function setStoredCustomer(name: string, mobile: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_NAME, name);
  localStorage.setItem(STORAGE_KEY_MOBILE, mobile);
}

interface OrderStatusResponse {
  status: 'created' | 'paid';
  queueItem?: { id: string; position: number; eta: number };
}

function formatEtaMessage(etaSeconds: number): string {
  if (etaSeconds <= 0) return 'Up next!';
  const totalMins = Math.ceil(etaSeconds / 60);
  if (totalMins < 60) {
    return `Your song will come up in approx ${totalMins} ${totalMins === 1 ? 'min' : 'mins'}`;
  }
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const parts = [`${hours} ${hours === 1 ? 'hr' : 'hrs'}`];
  if (mins > 0) parts.push(`${mins} ${mins === 1 ? 'min' : 'mins'}`);
  return `Your song will come up in approx ${parts.join(' ')}`;
}

export function UpiPaymentSheet({
  order,
  open,
  onClose,
  onSuccess,
  songTitle,
  amount,
  songId,
  venueId,
  onCreateOrder,
  customerName: customerNameProp,
  customerMobile: customerMobileProp,
}: UpiPaymentSheetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'waiting' | 'verifying' | 'success' | 'timeout'>('waiting');
  const [confirmedPayload, setConfirmedPayload] = useState<QueueConfirmPayload | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [formName, setFormName] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [notifySubscribing, setNotifySubscribing] = useState(false);
  const [notifySubscribed, setNotifySubscribed] = useState(false);

  // Pre-fill name and mobile from localStorage when payment sheet opens for the form
  useEffect(() => {
    if (open && !order && onCreateOrder && songId && venueId) {
      const { name, mobile } = getStoredCustomer();
      setFormName(name);
      setFormMobile(mobile);
    }
  }, [open, order, onCreateOrder, songId, venueId]);

  const applySuccess = useCallback(
    (data: QueueConfirmPayload) => {
      setStatus('success');
      setConfirmedPayload(data);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    if (!open || !order) return;

    setStatus('waiting');
    setConfirmedPayload(null);
    if (order.upiString && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, order.upiString, {
        width: 220,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
    }

    const socket = getSocket();
    connectSocket();
    socket.emit('join:order', { orderId: order.orderId });

    const socketHandler = (data: QueueConfirmPayload) => {
      applySuccess(data);
      setConfirmedPayload(data);
    };
    socket.on('queue:confirmed', socketHandler);

    const poll = async () => {
      try {
        const ref = order.paymentId ?? order.orderId;
        const res = await api.get<OrderStatusResponse>(`/payments/order-status?orderId=${encodeURIComponent(ref)}`);
        if (res.status === 'paid' && res.queueItem) {
          applySuccess({
            queueItem: { id: res.queueItem.id, position: res.queueItem.position },
            position: res.queueItem.position,
            eta: res.queueItem.eta,
          });
        }
      } catch {
        // ignore (order not found or network)
      }
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

    timerRef.current = setTimeout(() => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setStatus('timeout');
    }, TIMEOUT_MS);

    return () => {
      socket.off('queue:confirmed', socketHandler);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, [open, order, applySuccess]);

  // When we have confirmed payload, call onSuccess after delay (so user sees success screen)
  useEffect(() => {
    if (status !== 'success' || !confirmedPayload) return;
    successTimeoutRef.current = setTimeout(() => {
      onSuccess(confirmedPayload);
    }, 1500);
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, [status, confirmedPayload, onSuccess]);

  const handleContinueToPayment = async () => {
    if (!onCreateOrder || !formName.trim() || !formMobile.trim()) return;
    setStoredCustomer(formName.trim(), formMobile.trim());
    setCreatingOrder(true);
    try {
      await onCreateOrder(formName.trim(), formMobile.trim());
    } finally {
      setCreatingOrder(false);
    }
  };

  const showFormFirst = open && !order && onCreateOrder && songId && venueId;

  if (showFormFirst) {
    return (
      <BottomSheet open={open} onClose={onClose} title="Complete Payment">
        <div className="flex flex-col gap-5 pt-2">
          <div className="text-center">
            <p className="text-stone-900 font-display text-lg font-semibold truncate max-w-xs">
              {songTitle}
            </p>
            <p className="text-brand-600 text-2xl font-bold mt-1">₹{amount ?? 100}</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-stone-500 mb-1.5">Name</label>
              <input
                type="text"
                placeholder="Your name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-stone-500 mb-1.5">Mobile number</label>
              <input
                type="tel"
                placeholder="10-digit mobile number"
                value={formMobile}
                onChange={(e) => setFormMobile(e.target.value)}
                maxLength={10}
                className="w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-sm"
              />
            </div>
          </div>
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleContinueToPayment}
            loading={creatingOrder}
            disabled={!formName.trim() || !formMobile.trim() || formMobile.trim().length < 10}
          >
            Continue to payment
          </Button>
        </div>
      </BottomSheet>
    );
  }

  if (!order) return null;

  return (
    <BottomSheet open={open} onClose={onClose} title="Complete Payment">
      <div className="flex flex-col items-center gap-5 pt-2">
        <div className="text-center">
          <p className="text-stone-900 font-display text-lg font-semibold truncate max-w-xs">
            {order.song.title}
          </p>
          <p className="text-brand-600 text-2xl font-bold mt-1">₹{order.amount}</p>
        </div>

        {status === 'waiting' && (
          <>
            <div className="w-full space-y-3">
              <div>
                <label className="block text-sm text-stone-500 mb-1">Name</label>
                <div className="bg-stone-50 border border-surface-border rounded-xl px-4 py-3 text-stone-900 text-sm">
                  {customerNameProp || '—'}
                </div>
              </div>
              <div>
                <label className="block text-sm text-stone-500 mb-1">Mobile number</label>
                <div className="bg-stone-50 border border-surface-border rounded-xl px-4 py-3 text-stone-900 text-sm">
                  {customerMobileProp || '—'}
                </div>
              </div>
            </div>
            {order.upiString ? (
              <>
                <a
                  href={order.upiString}
                  className="block rounded-2xl overflow-hidden border-2 border-stone-200 p-1 bg-white cursor-pointer hover:border-stone-300 active:opacity-90 transition-colors w-fit mx-auto"
                  onClick={(e) => {
                    window.location.href = order.upiString!;
                    e.preventDefault();
                  }}
                  aria-label="Open UPI app to pay"
                >
                  <canvas ref={canvasRef} className="rounded-xl block" />
                </a>
                <p className="text-stone-500 text-sm text-center">
                  Scan the QR code or tap to open your UPI app
                </p>
                <a
                  href={order.upiString}
                  className="w-full"
                  onClick={(e) => {
                    window.location.href = order.upiString!;
                    e.preventDefault();
                  }}
                >
                  <Button variant="primary" size="lg" className="w-full">
                    Pay with UPI
                  </Button>
                </a>
              </>
            ) : order.qrImageUrl ? (
              <>
                <p className="text-stone-500 text-sm text-center">
                  Open the link below to pay with your UPI app
                </p>
                <a
                  href={order.qrImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full"
                >
                  <Button variant="primary" size="lg" className="w-full">
                    Pay with UPI
                  </Button>
                </a>
              </>
            ) : null}
            <div className="flex items-center gap-2 text-stone-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Waiting for payment confirmation...</span>
            </div>
          </>
        )}

        {status === 'verifying' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-14 h-14 text-brand-500 animate-spin" />
            <p className="text-stone-900 font-semibold text-lg">Payment completed</p>
            <p className="text-stone-500 text-sm text-center">
              Verifying and adding your song to the queue...
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle className="w-16 h-16 text-green-400" />
            <p className="text-stone-900 font-semibold text-lg">Payment Received!</p>
            <p className="text-stone-500 text-sm">Your song has been added to the queue.</p>
            {confirmedPayload && (
              <div className="w-full rounded-xl bg-stone-50 border border-stone-200 p-4 space-y-2 text-center">
                <p className="text-stone-900 font-medium">
                  Your song is <span className="text-brand-600">#{confirmedPayload.position}</span> in the queue
                </p>
                <p className="text-stone-500 text-sm">
                  {formatEtaMessage(confirmedPayload.eta)}
                </p>
                <p className="text-stone-400 text-xs">
                  {confirmedPayload.position <= 1
                    ? 'You’re next!'
                    : `Time is based on the total length of the ${confirmedPayload.position - 1} song${confirmedPayload.position === 2 ? '' : 's'} ahead of you.`}
                </p>
              </div>
            )}
            {order && 'orderId' in order && !notifySubscribed && (
              <button
                type="button"
                onClick={async () => {
                  setNotifySubscribing(true);
                  try {
                    const permission = await Notification.requestPermission();
                    if (permission !== 'granted') return;
                    const publicKey = await notifications.getVapidPublicKey();
                    if (!publicKey) return;
                    const sub = await notifications.subscribeForPush(publicKey);
                    if (!sub) return;
                    await api.post('/notifications/subscribe-customer', {
                      orderId: order.orderId,
                      subscription: notifications.subscriptionToPayload(sub),
                    });
                    setNotifySubscribed(true);
                  } catch (e) {
                    console.log('Notify subscribe failed', e);
                  } finally {
                    setNotifySubscribing(false);
                  }
                }}
                disabled={notifySubscribing}
                className="text-sm text-brand-600 hover:text-brand-700 font-medium disabled:opacity-50"
              >
                {notifySubscribing ? 'Subscribing…' : 'Notify me when my song plays'}
              </button>
            )}
            {notifySubscribed && (
              <p className="text-sm text-green-600">You'll get a notification when your song plays.</p>
            )}
          </div>
        )}

        {status === 'timeout' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <XCircle className="w-12 h-12 text-red-400" />
            <p className="text-stone-900 font-semibold">Payment not received</p>
            <p className="text-stone-500 text-sm text-center">
              The payment window has expired. Please try again.
            </p>
            <Button variant="outline" onClick={onClose} className="w-full">
              Try Again
            </Button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
