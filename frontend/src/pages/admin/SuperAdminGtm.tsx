import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Rocket, MapPin, Mail, Phone, Globe, CheckCircle, History, Copy, MessageCircle, Building2, Search } from 'lucide-react';
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

interface GtmLead {
  id: string;
  placeName: string | null;
  email: string | null;
  status: string;
  sentAt: string;
  createdAt: string;
  linkedinMessage: string | null;
}

interface OpenAIBarItem {
  name: string;
  address?: string;
  possibleDirectorName?: string;
  phone?: string;
  website?: string;
  area?: string;
}

export default function SuperAdminGtm() {
  const queryClient = useQueryClient();
  const [mapsUrl, setMapsUrl] = useState('');
  const [resolving, setResolving] = useState(false);
  const [place, setPlace] = useState<ResolvedPlace | null>(null);
  const [email, setEmail] = useState('');
  const [findingEmail, setFindingEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; error?: string; linkedinMessage?: string } | null>(null);
  const [linkedInCopiedId, setLinkedInCopiedId] = useState<string | null>(null);

  const [cityInput, setCityInput] = useState('');
  const [barsFromCity, setBarsFromCity] = useState<OpenAIBarItem[]>([]);
  const [findingBars, setFindingBars] = useState(false);

  const { data: leads = [], isLoading: leadsLoading } = useQuery<GtmLead[]>({
    queryKey: ['gtm', 'leads'],
    queryFn: () => api.get<GtmLead[]>('/gtm/leads'),
  });

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
      const result = await api.post<{ ok: boolean; error?: string; linkedinMessage?: string }>('/gtm/send-onboarding', {
        placeName: place.name,
        address: place.address,
        phone: place.phone,
        website: place.website,
        placeId: place.placeId,
        email: email.trim(),
      });
      setSendResult(result);
      if (result?.ok) {
        queryClient.invalidateQueries({ queryKey: ['gtm', 'leads'] });
      }
    } catch (e) {
      setSendResult({
        ok: false,
        error: e instanceof Error ? e.message : 'Failed to send',
      });
    } finally {
      setSending(false);
    }
  };

  const handleFindBarsByCity = async () => {
    if (!cityInput.trim()) return;
    setFindingBars(true);
    setBarsFromCity([]);
    try {
      const result = await api.post<{ bars: OpenAIBarItem[] }>('/gtm/find-bars-by-city', {
        city: cityInput.trim(),
      });
      setBarsFromCity(result.bars ?? []);
    } catch (e) {
      console.log('Find bars by city failed', e);
      setBarsFromCity([]);
    } finally {
      setFindingBars(false);
    }
  };

  const copyLinkedInMessage = async (text: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      const key = id ?? 'last-send';
      setLinkedInCopiedId(key);
      setTimeout(() => setLinkedInCopiedId(null), 2000);
    } catch {
      console.log('Copy failed');
    }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
      });
    } catch {
      return iso;
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
          Find bars by city (OpenAI) or paste a Google Maps link, resolve the place, then send an intro email.
        </p>
      </div>

      <Card className="p-4 mb-5">
        <h2 className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-brand-600" />
          Find bars by city
        </h2>
        <p className="text-stone-500 text-xs mb-3">
          Enter a city name (e.g. Gurgaon, Mumbai) and get top 100 bars with details including possible director/contact names.
        </p>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="e.g. Gurgaon, Delhi NCR"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFindBarsByCity()}
            className="flex-1 min-w-0 bg-white border border-surface-border rounded-xl px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-sm"
          />
          <Button onClick={handleFindBarsByCity} loading={findingBars} disabled={!cityInput.trim()}>
            <Search className="w-4 h-4 mr-1" />
            Find
          </Button>
        </div>
        {barsFromCity.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-stone-200 max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-stone-50 border-b border-stone-200">
                <tr className="text-left text-stone-500 uppercase tracking-wider text-xs">
                  <th className="py-2 px-2 font-medium">#</th>
                  <th className="py-2 px-2 font-medium">Name</th>
                  <th className="py-2 px-2 font-medium">Address / Area</th>
                  <th className="py-2 px-2 font-medium">Director / Contact</th>
                  <th className="py-2 px-2 font-medium">Phone</th>
                  <th className="py-2 px-2 font-medium">Website</th>
                </tr>
              </thead>
              <tbody>
                {barsFromCity.map((bar, i) => (
                  <tr key={i} className="border-b border-stone-100 hover:bg-stone-50/50">
                    <td className="py-2 px-2 text-stone-400">{i + 1}</td>
                    <td className="py-2 px-2 font-medium text-stone-900">{bar.name}</td>
                    <td className="py-2 px-2 text-stone-700 max-w-[200px] truncate" title={bar.address ?? bar.area}>
                      {bar.address ?? bar.area ?? '—'}
                    </td>
                    <td className="py-2 px-2 text-stone-700">{bar.possibleDirectorName ?? '—'}</td>
                    <td className="py-2 px-2 text-stone-700">{bar.phone ?? '—'}</td>
                    <td className="py-2 px-2">
                      {bar.website ? (
                        <a href={bar.website} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline truncate max-w-[120px] block">
                          Link
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {findingBars && barsFromCity.length === 0 && (
          <p className="text-stone-500 text-sm">Finding bars…</p>
        )}
      </Card>

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
              {sendResult?.ok && sendResult.linkedinMessage && (
                <div className="mt-4 p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" />
                    LinkedIn message (copy & paste)
                  </p>
                  <pre className="text-sm text-stone-800 whitespace-pre-wrap font-sans mb-2 max-h-40 overflow-y-auto">
                    {sendResult.linkedinMessage}
                  </pre>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyLinkedInMessage(sendResult.linkedinMessage!, 'last-send')}
                    className="flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {linkedInCopiedId === 'last-send' ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
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

      <Card className="p-4 mt-6">
        <h2 className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-2">
          <History className="w-4 h-4 text-stone-500" />
          Recent onboarding emails
        </h2>
        {leadsLoading ? (
          <p className="text-stone-500 text-sm">Loading…</p>
        ) : leads.length === 0 ? (
          <p className="text-stone-500 text-sm">No onboarding emails sent yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-stone-500 border-b border-stone-200">
                  <th className="py-2 px-2 font-medium">Venue</th>
                  <th className="py-2 px-2 font-medium">Email</th>
                  <th className="py-2 px-2 font-medium">Status</th>
                  <th className="py-2 px-2 font-medium">Sent</th>
                  <th className="py-2 px-2 font-medium">LinkedIn</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-stone-100">
                    <td className="py-2 px-2 text-stone-900">{lead.placeName ?? '—'}</td>
                    <td className="py-2 px-2 text-stone-700">{lead.email ?? '—'}</td>
                    <td className="py-2 px-2">
                      <span
                        className={
                          lead.status === 'sent'
                            ? 'text-green-600'
                            : lead.status === 'failed'
                              ? 'text-red-600'
                              : 'text-stone-500'
                        }
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-stone-500">{formatDate(lead.sentAt)}</td>
                    <td className="py-2 px-2">
                      {lead.linkedinMessage ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => copyLinkedInMessage(lead.linkedinMessage!, lead.id)}
                          className="flex items-center gap-1"
                          title="Copy LinkedIn message"
                        >
                          <Copy className="w-3 h-3" />
                          {linkedInCopiedId === lead.id ? 'Copied!' : 'Copy'}
                        </Button>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
