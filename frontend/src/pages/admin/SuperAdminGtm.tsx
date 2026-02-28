import { useState } from 'react';
import { Rocket, MapPin, Mail, Phone, Globe, CheckCircle } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

interface ResolvedPlace {
  placeId: string;
  name: string;
  address?: string;
  phone?: string;
  website?: string;
}

export default function SuperAdminGtm() {
  const [mapsUrl, setMapsUrl] = useState('');
  const [resolving, setResolving] = useState(false);
  const [place, setPlace] = useState<ResolvedPlace | null>(null);
  const [email, setEmail] = useState('');
  const [findingEmail, setFindingEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const handleResolve = async () => {
    if (!mapsUrl.trim()) return;
    setResolving(true);
    setPlace(null);
    setSendResult(null);
    try {
      const result = await api.post<ResolvedPlace | null>('/gtm/resolve-place', { mapsUrl: mapsUrl.trim() });
      setPlace(result);
      setEmail('');
    } catch (e) {
      console.log('Resolve place failed', e);
      setPlace(null);
    } finally {
      setResolving(false);
    }
  };

  const handleFindEmail = async () => {
    if (!place?.website) return;
    setFindingEmail(true);
    try {
      const result = await api.post<{ email: string | null }>('/gtm/find-email', {
        websiteUrl: place.website,
      });
      if (result.email) setEmail(result.email);
    } catch (e) {
      console.log('Find email failed', e);
    } finally {
      setFindingEmail(false);
    }
  };

  const handleSend = async () => {
    if (!place || !email.trim()) return;
    setSending(true);
    setSendResult(null);
    try {
      const result = await api.post<{ ok: boolean; error?: string }>('/gtm/send-onboarding', {
        placeName: place.name,
        address: place.address,
        phone: place.phone,
        website: place.website,
        placeId: place.placeId,
        email: email.trim(),
      });
      setSendResult(result);
    } catch (e) {
      setSendResult({
        ok: false,
        error: e instanceof Error ? e.message : 'Failed to send',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold text-stone-900 flex items-center gap-2" data-testid="gtm-heading">
          <Rocket className="w-6 h-6 text-brand-600" />
          GTM — Onboard a bar
        </h1>
        <p className="text-stone-500 text-sm mt-0.5">
          Paste a Google Maps link, resolve the place, find or enter email, then send an intro email.
        </p>
      </div>

      <Card className="p-4 mb-5">
        <h2 className="text-sm font-semibold text-stone-900 mb-3">1. Google Maps link</h2>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://www.google.com/maps/place/DLF+Downtown,+Gurugram/@28.4954062,77.0843458,15.63z"
            value={mapsUrl}
            onChange={(e) => setMapsUrl(e.target.value)}
            className="flex-1 min-w-0 bg-white border border-surface-border rounded-xl px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-sm"
            data-testid="gtm-maps-url"
          />
          <Button onClick={handleResolve} loading={resolving} disabled={!mapsUrl.trim()} data-testid="gtm-resolve-btn">
            Resolve
          </Button>
        </div>
      </Card>

      {place && (
        <>
          <Card className="p-4 mb-5">
            <h2 className="text-sm font-semibold text-stone-900 mb-3">2. Place details</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-stone-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-stone-900">{place.name}</p>
                  {place.address && <p className="text-stone-600">{place.address}</p>}
                </div>
              </div>
              {place.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-stone-500 shrink-0" />
                  <a href={`tel:${place.phone}`} className="text-brand-600 hover:underline">
                    {place.phone}
                  </a>
                </div>
              )}
              {place.website && (
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-stone-500 shrink-0" />
                  <a
                    href={place.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:underline truncate"
                  >
                    {place.website}
                  </a>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4 mb-5">
            <h2 className="text-sm font-semibold text-stone-900 mb-3">3. Email & send</h2>
            <p className="text-stone-500 text-xs mb-3">
              Email is not in the Places API. Try to find it from the venue website or enter manually.
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    label="Contact email"
                    type="email"
                    placeholder="bar@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {place.website && (
                  <div className="flex items-end pb-2">
                    <Button
                      variant="outline"
                      onClick={handleFindEmail}
                      loading={findingEmail}
                      disabled={findingEmail}
                    >
                      Find from website
                    </Button>
                  </div>
                )}
              </div>
              <Button
                onClick={handleSend}
                loading={sending}
                disabled={!email.trim()}
                className="flex items-center gap-2"
              >
                {sendResult?.ok ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Sent
                  </>
                ) : (
                  'Send onboarding email'
                )}
              </Button>
              {sendResult && !sendResult.ok && (
                <p className="text-sm text-red-600">{sendResult.error}</p>
              )}
            </div>
          </Card>
        </>
      )}

      {!place && !resolving && (
        <div className="text-center py-8 text-stone-500">
          <Mail className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Paste a Google Maps link and click Resolve to get started.</p>
        </div>
      )}
    </div>
  );
}
