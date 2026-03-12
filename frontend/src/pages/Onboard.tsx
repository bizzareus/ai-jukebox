import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Music2, QrCode } from 'lucide-react';
import { api } from '../services/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

interface OnboardContext {
  barName: string | null;
  phone: string | null;
  conversationId: string;
  alreadyOnboarded: boolean;
  venueSlug: string | null;
}

interface OnboardCompleteResult {
  slug: string;
  qrCodeUrl: string;
  loginLink: string;
  venueId: string;
}

type Step = 'loading' | 'invalid' | 'already-done' | 'form' | 'success';

export default function Onboard() {
  const [searchParams] = useSearchParams();
  const conversationId = searchParams.get('c');

  const [step, setStep] = useState<Step>('loading');
  const [context, setContext] = useState<OnboardContext | null>(null);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [venueName, setVenueName] = useState('');
  const [pricePerSong, setPricePerSong] = useState<number>(0);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [result, setResult] = useState<OnboardCompleteResult | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setStep('invalid');
      return;
    }
    let cancelled = false;
    setStep('loading');
    setError('');
    api
      .get<OnboardContext>(`/gtm/onboard/context/${conversationId}`)
      .then((ctx) => {
        if (cancelled) return;
        setContext(ctx);
        if (ctx.alreadyOnboarded) {
          setStep('already-done');
          return;
        }
        setVenueName(ctx.barName ?? '');
        setStep('form');
      })
      .catch(() => {
        if (cancelled) return;
        setStep('invalid');
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!context?.conversationId) return;
    setError('');
    setSubmitLoading(true);
    try {
      const res = await api.post<OnboardCompleteResult>('/gtm/onboard/complete', {
        conversationId: context.conversationId,
        email: email.trim(),
        password,
        name: name.trim(),
        venueName: venueName.trim(),
        pricePerSong: Number(pricePerSong) || 0,
      });
      setResult(res);
      setStep('success');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleGoToAdmin = () => {
    if (result?.loginLink) {
      window.location.href = result.loginLink;
    }
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-5">
        <div className="text-stone-500 text-sm">Loading…</div>
      </div>
    );
  }

  if (step === 'invalid') {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-5">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex justify-center w-14 h-14 bg-stone-200 rounded-2xl mb-4">
            <Music2 className="w-7 h-7 text-stone-500" />
          </div>
          <h1 className="font-display text-xl font-bold text-stone-900">Invalid link</h1>
          <p className="text-stone-500 text-sm mt-2">
            This onboarding link is invalid or has expired. Please ask for a new link from the person who contacted you.
          </p>
        </div>
      </div>
    );
  }

  if (step === 'already-done') {
    const loginUrl = `${window.location.origin}/admin/login`;
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-5">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex justify-center w-14 h-14 bg-brand-100 rounded-2xl mb-4 border border-brand-200">
            <Music2 className="w-7 h-7 text-brand-600" />
          </div>
          <h1 className="font-display text-xl font-bold text-stone-900">You’re all set</h1>
          <p className="text-stone-500 text-sm mt-2">
            Your venue is already set up. Log in to manage your jukebox.
          </p>
          <a
            href={loginUrl}
            className="mt-6 inline-block rounded-xl bg-brand-600 px-6 py-3 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            Go to login
          </a>
        </div>
      </div>
    );
  }

  if (step === 'form' && context) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-5 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex justify-center w-14 h-14 bg-brand-100 rounded-2xl mb-4 border border-brand-200">
              <Music2 className="w-7 h-7 text-brand-600" />
            </div>
            <h1 className="font-display text-2xl font-bold text-stone-900">MuzoBox</h1>
            <p className="text-stone-500 text-sm mt-0.5">Set up your venue</p>
            {context.barName && (
              <p className="text-stone-600 text-sm mt-2 font-medium">Welcome, {context.barName}</p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Your name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              placeholder="you@venue.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <Input
              label="Venue name"
              type="text"
              placeholder="Bar or restaurant name"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label id="onboard-price-label" className="text-sm font-medium text-gray-300" htmlFor="onboard-price">
                Price per song (₹)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="onboard-price"
                  type="number"
                  min={0}
                  step={1}
                  value={pricePerSong}
                  onChange={(e) => setPricePerSong(Number(e.target.value) || 0)}
                  aria-labelledby="onboard-price-label"
                  placeholder="0"
                  className="w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                />
                <span className="text-stone-500 text-sm shrink-0">0 = free</span>
              </div>
              <p className="text-xs text-stone-400">Set how much you want to charge per song (or 0 for free).</p>
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <Button type="submit" disabled={submitLoading} className="w-full">
              {submitLoading ? 'Setting up…' : 'Set up my venue'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'success' && result) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-5 py-8">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex justify-center w-14 h-14 bg-brand-100 rounded-2xl mb-4 border border-brand-200">
            <QrCode className="w-7 h-7 text-brand-600" />
          </div>
          <h1 className="font-display text-2xl font-bold text-stone-900">You’re all set</h1>
          <p className="text-stone-500 text-sm mt-2">
            Get this QR code printed and place it at your venue. Customers will scan it to play songs.
          </p>
          {result.qrCodeUrl && (
            <div className="mt-6 p-4 bg-white rounded-xl border border-stone-200 inline-block">
              <img
                src={result.qrCodeUrl}
                alt="Venue QR code"
                className="w-56 h-56 object-contain"
              />
            </div>
          )}
          <p className="text-stone-500 text-xs mt-4">
            Your venue link: <strong>/{result.slug}</strong>
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Button onClick={handleGoToAdmin} className="w-full">
              Go to admin
            </Button>
            <p className="text-stone-400 text-xs">
              You can reprint or change settings anytime from the admin dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
