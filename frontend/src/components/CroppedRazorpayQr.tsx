import { useEffect, useState } from 'react';
import jsQR from 'jsqr';
import { Loader2 } from 'lucide-react';
import { Button } from './ui/Button';

interface CroppedRazorpayQrProps {
  qrImageUrl: string;
  className?: string;
  /** Called with the decoded URL when user clicks the QR or Pay button (so parent can open it) */
  onOpenUrl?: (url: string) => void;
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; croppedDataUrl: string; decodedUrl: string }
  | { status: 'error'; fallbackUrl: string };

/**
 * Loads the Razorpay QR image, uses jsQR to find and decode the QR code,
 * crops the image to just the QR region, and displays it. On click, opens the decoded UPI URL.
 */
export function CroppedRazorpayQr({
  qrImageUrl,
  className = '',
  onOpenUrl,
}: CroppedRazorpayQrProps) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (cancelled) return;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w === 0 || h === 0) {
        setState({ status: 'error', fallbackUrl: qrImageUrl });
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setState({ status: 'error', fallbackUrl: qrImageUrl });
        return;
      }

      try {
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, w, h);
        const code = jsQR(imageData.data, w, h);
        if (!code || !code.data) {
          setState({ status: 'error', fallbackUrl: qrImageUrl });
          return;
        }

        const loc = code.location;
        const corners = [
          loc.topLeftCorner,
          loc.topRightCorner,
          loc.bottomLeftCorner,
          loc.bottomRightCorner,
        ];
        const minX = Math.max(0, Math.min(...corners.map((c) => c.x)) - 8);
        const minY = Math.max(0, Math.min(...corners.map((c) => c.y)) - 8);
        const maxX = Math.min(w, Math.max(...corners.map((c) => c.x)) + 8);
        const maxY = Math.min(h, Math.max(...corners.map((c) => c.y)) + 8);
        const cropW = maxX - minX;
        const cropH = maxY - minY;

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropCtx = cropCanvas.getContext('2d');
        if (!cropCtx) {
          setState({ status: 'error', fallbackUrl: qrImageUrl });
          return;
        }
        cropCtx.drawImage(
          canvas,
          minX,
          minY,
          cropW,
          cropH,
          0,
          0,
          cropW,
          cropH,
        );
        const dataUrl = cropCanvas.toDataURL('image/png');

        setState({
          status: 'ready',
          croppedDataUrl: dataUrl,
          decodedUrl: code.data,
        });
      } catch {
        setState({ status: 'error', fallbackUrl: qrImageUrl });
      }
    };

    img.onerror = () => {
      if (!cancelled) setState({ status: 'error', fallbackUrl: qrImageUrl });
    };

    img.src = qrImageUrl;

    return () => {
      cancelled = true;
    };
  }, [qrImageUrl]);

  const handleOpen = (url: string) => {
    onOpenUrl?.(url);
    window.location.href = url;
  };

  if (state.status === 'loading') {
    return (
      <div className={`flex flex-col items-center justify-center py-8 ${className}`}>
        <Loader2 className="w-10 h-10 text-stone-400 animate-spin" />
        <p className="text-stone-500 text-sm mt-2">Loading QR code...</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className={`flex flex-col items-center gap-3 ${className}`}>
        <p className="text-stone-500 text-sm text-center">
          Scan the QR code or open the link to pay with your UPI app
        </p>
        <a
          href={state.fallbackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-2xl overflow-hidden border-2 border-stone-200 p-1 bg-white block w-fit mx-auto focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          aria-label="Open payment page"
        >
          <img
            src={state.fallbackUrl}
            alt="QR code - scan or tap to pay"
            className="rounded-xl block max-w-[220px] h-auto"
          />
        </a>
        <a
          href={state.fallbackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full"
        >
          <Button variant="primary" size="lg" className="w-full">
            Pay with UPI
          </Button>
        </a>
      </div>
    );
  }

  // Use extracted QR content (decodedUrl) as the link so the button opens the UPI intent
  const upiLink = state.decodedUrl;

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <a
        href={upiLink}
        onClick={(e) => {
          handleOpen(upiLink);
          e.preventDefault();
        }}
        className="rounded-2xl overflow-hidden border-2 border-stone-200 p-1 bg-white cursor-pointer hover:border-stone-300 active:opacity-90 transition-colors w-fit mx-auto focus:outline-none focus:ring-2 focus:ring-brand-500/30 block"
        aria-label="Open UPI app to pay"
      >
        <img
          src={state.croppedDataUrl}
          alt="Scan or tap to pay with UPI"
          className="rounded-xl block max-w-[220px] h-auto"
        />
      </a>
      <p className="text-stone-500 text-sm text-center">
        Scan the QR code or tap to open your UPI app
      </p>
      <a
        href={upiLink}
        className="w-full inline-flex items-center justify-center gap-2 font-semibold rounded-xl px-6 py-3.5 text-base bg-brand-600 text-white hover:bg-brand-700 shadow-md shadow-brand-600/20 transition-all active:scale-95"
        onClick={(e) => {
          handleOpen(upiLink);
          e.preventDefault();
        }}
      >
        Pay with UPI
      </a>
    </div>
  );
}
