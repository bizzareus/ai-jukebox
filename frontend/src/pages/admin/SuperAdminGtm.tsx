import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Rocket, MapPin, Mail, Phone, Globe, CheckCircle, History, Copy, MessageCircle, Building2, Search, MessageSquare } from 'lucide-react';
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

/** Bar from Google Places Nearby Search (lat/lng + 5km radius). */
interface BarFromLocation {
  placeId: string;
  name: string;
  address?: string;
  phone?: string;
  website?: string;
}

interface WhatsappConversation {
  id: string;
  phone: string;
  barName: string | null;
  updatedAt: string;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
}

interface WhatsappMessage {
  id: string;
  direction: 'in' | 'out';
  body: string;
  isAiReply: boolean;
  createdAt: string;
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

  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');
  const [barsFromLocation, setBarsFromLocation] = useState<BarFromLocation[]>([]);
  const [findingBarsByLocation, setFindingBarsByLocation] = useState(false);
  const [rowEmails, setRowEmails] = useState<Record<string, string>>({});
  const [rowMobileOverrides, setRowMobileOverrides] = useState<Record<string, string>>({});
  const [rowContactNames, setRowContactNames] = useState<Record<string, string>>({});
  const [rowMessages, setRowMessages] = useState<Record<string, string>>({});
  const [findingEmailForPlaceId, setFindingEmailForPlaceId] = useState<string | null>(null);
  const [findingMobileForPlaceId, setFindingMobileForPlaceId] = useState<string | null>(null);
  const [sendingForPlaceId, setSendingForPlaceId] = useState<string | null>(null);
  const [sendResultForPlaceId, setSendResultForPlaceId] = useState<Record<string, { ok: boolean; error?: string }>>({});
  const [expandedMessagePlaceId, setExpandedMessagePlaceId] = useState<string | null>(null);

  const [selectedBarIds, setSelectedBarIds] = useState<Record<string, boolean>>({});
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const [whatsappSendResult, setWhatsappSendResult] = useState<{ sent: number; failed: number } | null>(null);
  const [expandedConversationId, setExpandedConversationId] = useState<string | null>(null);
  const [gtmTab, setGtmTab] = useState<'find-bars' | 'reached-out'>('find-bars');

  const { data: leads = [], isLoading: leadsLoading } = useQuery<GtmLead[]>({
    queryKey: ['gtm', 'leads'],
    queryFn: () => api.get<GtmLead[]>('/gtm/leads'),
  });

  const { data: whatsappConversations = [], isLoading: whatsappConvosLoading } = useQuery<WhatsappConversation[]>({
    queryKey: ['gtm', 'whatsapp', 'conversations'],
    queryFn: () => api.get<WhatsappConversation[]>('/gtm/whatsapp/conversations'),
  });

  const { data: whatsappMessages = [] } = useQuery<WhatsappMessage[]>({
    queryKey: ['gtm', 'whatsapp', 'messages', expandedConversationId],
    queryFn: () =>
      api.get<WhatsappMessage[]>(`/gtm/whatsapp/conversations/${expandedConversationId}/messages`),
    enabled: !!expandedConversationId,
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

  const handleFindBarsByLocation = async () => {
    const lat = parseFloat(latInput.trim());
    const lng = parseFloat(lngInput.trim());
    if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
    setFindingBarsByLocation(true);
    setBarsFromLocation([]);
    setRowEmails({});
    setRowMobileOverrides({});
    setRowContactNames({});
    setRowMessages({});
    setSendResultForPlaceId({});
    setSelectedBarIds({});
    try {
      const result = await api.post<{ bars: BarFromLocation[] }>('/gtm/find-bars-by-location', { lat, lng });
      setBarsFromLocation(result.bars ?? []);
    } catch (e) {
      console.log('Find bars by location failed', e);
      setBarsFromLocation([]);
    } finally {
      setFindingBarsByLocation(false);
    }
  };

  const buildOnboardingMessage = (
    signupLink: string,
    contactName?: string | null,
  ): string => {
    const name = (contactName?.trim() || 'there').replace(/\s+/g, ' ');
    return `Hi ${name}, I'm Kartik from MuzoBox 🎶

We help bars & restaurants boost customer engagement and drive extra revenue during non-DJ hours by letting your guests play music directly from their phones. With MuzoBox, your playlist is curated by you to match your venue's vibe, so customers choose from songs you've approved — keeping the music relevant and fun.

Get started here: ${signupLink}`;
  };

  const fetchMessageForRow = async (bar: BarFromLocation) => {
    const email = rowEmails[bar.placeId]?.trim();
    const contactName = rowContactNames[bar.placeId]?.trim() || undefined;
    if (!email) return;
    try {
      const result = await api.post<{ message: string; signupLink: string }>(
        '/gtm/onboarding-message',
        {
          placeName: bar.name,
          address: bar.address,
          placeId: bar.placeId,
          email,
          contactName,
        },
      );
      if (result.message)
        setRowMessages((prev) => ({ ...prev, [bar.placeId]: result.message }));
    } catch (e) {
      console.log('Fetch onboarding message failed', e);
    }
  };

  const handleFindMobileForRow = async (bar: BarFromLocation) => {
    setFindingMobileForPlaceId(bar.placeId);
    try {
      const result = await api.post<{
        mobile: string | null;
        contactName: string | null;
      }>('/gtm/find-mobile', {
        venueName: bar.name,
        address: bar.address,
      });
      if (result.mobile)
        setRowMobileOverrides((prev) => ({
          ...prev,
          [bar.placeId]: result.mobile!,
        }));
      if (result.contactName)
        setRowContactNames((prev) => ({
          ...prev,
          [bar.placeId]: result.contactName!,
        }));
      if (result.mobile || result.contactName)
        setRowMessages((prev) => {
          const next = { ...prev };
          delete next[bar.placeId];
          return next;
        });
    } catch (e) {
      console.log('Find mobile failed', e);
    } finally {
      setFindingMobileForPlaceId(null);
    }
  };

  const handleFindEmailForRow = async (website: string, placeId: string) => {
    setFindingEmailForPlaceId(placeId);
    try {
      const result = await api.post<{ email: string | null }>('/gtm/find-email', { websiteUrl: website });
      if (result.email) setRowEmails((prev) => ({ ...prev, [placeId]: result.email! }));
    } catch (e) {
      console.log('Find email failed', e);
    } finally {
      setFindingEmailForPlaceId(null);
    }
  };

  const handleSendForRow = async (bar: BarFromLocation) => {
    const mobile = rowMobileOverrides[bar.placeId] ?? bar.phone;
    if (!mobile) return;
    const message =
      whatsappMessage.trim() ||
      buildOnboardingMessage(
        `${window.location.origin}/sample-bar?from=whatsapp-onboard`,
        rowContactNames[bar.placeId] ?? null,
      );
    setSendingForPlaceId(bar.placeId);
    setSendResultForPlaceId((prev) => ({ ...prev, [bar.placeId]: { ok: false } }));
    try {
      const result = await api.post<{ sent: number; failed: number }>('/gtm/whatsapp/send', {
        bars: [{ phone: mobile, barName: bar.name }],
        message,
      });
      const ok = result.sent > 0;
      setSendResultForPlaceId((prev) => ({ ...prev, [bar.placeId]: { ok, error: ok ? undefined : 'Send failed' } }));
      if (ok) queryClient.invalidateQueries({ queryKey: ['gtm', 'whatsapp', 'conversations'] });
    } catch (e) {
      setSendResultForPlaceId((prev) => ({
        ...prev,
        [bar.placeId]: { ok: false, error: e instanceof Error ? e.message : 'Failed to send' },
      }));
    } finally {
      setSendingForPlaceId(null);
    }
  };

  const toggleBarSelection = (placeId: string) => {
    setSelectedBarIds((prev) => ({ ...prev, [placeId]: !prev[placeId] }));
  };

  const selectedBarsWithPhone = barsFromLocation.filter((bar) => {
    const phone = rowMobileOverrides[bar.placeId] ?? bar.phone;
    return phone && selectedBarIds[bar.placeId];
  });

  const handleSendWhatsapp = async () => {
    if (selectedBarsWithPhone.length === 0 || !whatsappMessage.trim()) return;
    setSendingWhatsapp(true);
    setWhatsappSendResult(null);
    try {
      const result = await api.post<{ sent: number; failed: number }>('/gtm/whatsapp/send', {
        bars: selectedBarsWithPhone.map((bar) => ({
          phone: rowMobileOverrides[bar.placeId] ?? bar.phone,
          barName: bar.name,
        })),
        message: whatsappMessage.trim(),
      });
      setWhatsappSendResult({ sent: result.sent, failed: result.failed });
      if (result.sent > 0) {
        queryClient.invalidateQueries({ queryKey: ['gtm', 'whatsapp', 'conversations'] });
      }
    } catch (e) {
      console.log('Send WhatsApp failed', e);
      setWhatsappSendResult({ sent: 0, failed: selectedBarsWithPhone.length });
    } finally {
      setSendingWhatsapp(false);
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
          Enter lat/lng to find bars in 5km radius (Google Maps), then send onboarding email or WhatsApp.
        </p>
        <div className="flex gap-1 mt-4 border-b border-stone-200">
          <button
            type="button"
            onClick={() => setGtmTab('find-bars')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              gtmTab === 'find-bars'
                ? 'bg-white border border-stone-200 border-b-0 -mb-px text-stone-900'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            Find bars
          </button>
          <button
            type="button"
            onClick={() => setGtmTab('reached-out')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1 ${
              gtmTab === 'reached-out'
                ? 'bg-white border border-stone-200 border-b-0 -mb-px text-stone-900'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Reached out
            {whatsappConversations.length > 0 && (
              <span className="bg-stone-200 text-stone-700 text-xs px-1.5 rounded">
                {whatsappConversations.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {gtmTab === 'find-bars' && (
      <>
      <Card className="p-4 mb-5">
        <h2 className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-brand-600" />
          Find bars by location (5km radius)
        </h2>
        <p className="text-stone-500 text-xs mb-3">
          Enter latitude and longitude of the area. Bars and night clubs within 5km will be listed with name, mobile, and onboarding message.
        </p>
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <input
            type="text"
            inputMode="decimal"
            placeholder="Latitude (e.g. 28.49)"
            value={latInput}
            onChange={(e) => setLatInput(e.target.value)}
            className="w-36 bg-white border border-surface-border rounded-xl px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-sm"
          />
          <input
            type="text"
            inputMode="decimal"
            placeholder="Longitude (e.g. 77.08)"
            value={lngInput}
            onChange={(e) => setLngInput(e.target.value)}
            className="w-36 bg-white border border-surface-border rounded-xl px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-sm"
          />
          <Button
            onClick={handleFindBarsByLocation}
            loading={findingBarsByLocation}
            disabled={!latInput.trim() || !lngInput.trim()}
          >
            <Search className="w-4 h-4 mr-1" />
            Find bars
          </Button>
        </div>
        {barsFromLocation.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <textarea
                placeholder="Message to send via WhatsApp (default: MuzoBox intro)"
                value={whatsappMessage}
                onChange={(e) => setWhatsappMessage(e.target.value)}
                onFocus={() => {
                  if (!whatsappMessage.trim()) {
                    setWhatsappMessage(
                      buildOnboardingMessage(
                        `${window.location.origin}/sample-bar?from=whatsapp-onboard`,
                        null,
                      ),
                    );
                  }
                }}
                className="flex-1 min-w-[200px] min-h-[80px] bg-white border border-surface-border rounded-xl px-3 py-2 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-sm"
              />
              <Button
                onClick={handleSendWhatsapp}
                loading={sendingWhatsapp}
                disabled={selectedBarsWithPhone.length === 0 || !whatsappMessage.trim()}
                className="flex items-center gap-1"
              >
                <MessageSquare className="w-4 h-4" />
                Send WhatsApp ({selectedBarsWithPhone.length} selected)
              </Button>
            </div>
            {whatsappSendResult && (
              <p className="text-sm text-stone-600 mt-1">
                Sent: {whatsappSendResult.sent}, Failed: {whatsappSendResult.failed}
              </p>
            )}
            <div className="overflow-x-auto rounded-xl border border-stone-200 max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-stone-50 border-b border-stone-200 z-10">
                <tr className="text-left text-stone-500 uppercase tracking-wider text-xs">
                  <th className="py-2 px-2 font-medium w-10">WA</th>
                  <th className="py-2 px-2 font-medium">#</th>
                  <th className="py-2 px-2 font-medium">Name</th>
                  <th className="py-2 px-2 font-medium">Mobile</th>
                  <th className="py-2 px-2 font-medium">Address</th>
                  <th className="py-2 px-2 font-medium">Email</th>
                  <th className="py-2 px-2 font-medium">Message</th>
                  <th className="py-2 px-2 font-medium">Send</th>
                </tr>
              </thead>
              <tbody>
                {barsFromLocation.map((bar, i) => {
                  const rowEmail = rowEmails[bar.placeId] ?? '';
                  const displayPhone = rowMobileOverrides[bar.placeId] ?? bar.phone;
                  const genericLink = `${window.location.origin}/sample-bar?from=whatsapp-onboard`;
                  const message =
                    rowMessages[bar.placeId] ??
                    buildOnboardingMessage(
                      genericLink,
                      rowContactNames[bar.placeId] || null,
                    );
                  const result = sendResultForPlaceId[bar.placeId];
                  const isExpanded = expandedMessagePlaceId === bar.placeId;
                  const hasPhone = !!(rowMobileOverrides[bar.placeId] ?? bar.phone);
                  return (
                    <tr key={bar.placeId} className="border-b border-stone-100 hover:bg-stone-50/50">
                      <td className="py-2 px-2 align-top">
                        {hasPhone ? (
                          <input
                            type="checkbox"
                            checked={!!selectedBarIds[bar.placeId]}
                            onChange={() => toggleBarSelection(bar.placeId)}
                            className="rounded border-stone-300"
                            aria-label={`Select ${bar.name} for WhatsApp`}
                          />
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-stone-400 align-top">{i + 1}</td>
                      <td className="py-2 px-2 font-medium text-stone-900 align-top max-w-[140px]">{bar.name}</td>
                      <td className="py-2 px-2 text-stone-700 align-top">
                        <div className="flex flex-col gap-1">
                          {displayPhone ? (
                            <a href={`tel:${displayPhone}`} className="text-brand-600 hover:underline whitespace-nowrap">
                              {displayPhone}
                            </a>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleFindMobileForRow(bar)}
                            loading={findingMobileForPlaceId === bar.placeId}
                            disabled={findingMobileForPlaceId === bar.placeId}
                            className="text-xs"
                          >
                            Find mobile (OpenAI)
                          </Button>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-stone-700 align-top max-w-[180px] truncate" title={bar.address}>
                        {bar.address ?? '—'}
                      </td>
                      <td className="py-2 px-2 align-top">
                        <div className="flex flex-col gap-1">
                          <input
                            type="email"
                            placeholder="Enter or find"
                            value={rowEmail}
                            onChange={(e) =>
                              setRowEmails((prev) => ({ ...prev, [bar.placeId]: e.target.value }))
                            }
                            onBlur={() => fetchMessageForRow(bar)}
                            className="w-full min-w-[140px] bg-white border border-surface-border rounded-lg px-2 py-1.5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-brand-500/30 text-xs"
                          />
                          {bar.website && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleFindEmailForRow(bar.website!, bar.placeId)}
                              loading={findingEmailForPlaceId === bar.placeId}
                              disabled={findingEmailForPlaceId === bar.placeId}
                              className="text-xs"
                            >
                              Find from website
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 align-top max-w-[220px]">
                        <div className="flex flex-col gap-1">
                          <p
                            className={`text-stone-600 whitespace-pre-wrap text-xs ${
                              isExpanded ? '' : 'line-clamp-2'
                            }`}
                            title={message}
                          >
                            {message}
                          </p>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => copyLinkedInMessage(message, `msg-${bar.placeId}`)}
                              className="flex items-center gap-1 text-xs"
                            >
                              <Copy className="w-3 h-3" />
                              {linkedInCopiedId === `msg-${bar.placeId}` ? 'Copied!' : 'Copy'}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setExpandedMessagePlaceId((prev) =>
                                  prev === bar.placeId ? null : bar.placeId,
                                )
                              }
                              className="text-xs"
                            >
                              {isExpanded ? 'Collapse' : 'Expand'}
                            </Button>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2 align-top">
                        <div className="flex flex-col gap-1">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleSendForRow(bar)}
                            loading={sendingForPlaceId === bar.placeId}
                            disabled={!hasPhone || sendingForPlaceId === bar.placeId}
                          >
                            {result?.ok ? 'Sent' : 'Send'}
                          </Button>
                          {result && !result.ok && result.error && (
                            <span className="text-xs text-red-600 max-w-[100px] truncate" title={result.error}>
                              {result.error}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
        {findingBarsByLocation && barsFromLocation.length === 0 && (
          <p className="text-stone-500 text-sm">Finding bars in 5km radius…</p>
        )}
      </Card>

      <Card className="p-4 mb-5">
        <h2 className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-stone-400" />
          Alternatively: Find bars by city (OpenAI)
        </h2>
        <p className="text-stone-500 text-xs mb-3">
          Enter a city name to get top 100 bars with details (no radius; uses OpenAI).
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
      </>
      )}

      {gtmTab === 'reached-out' && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-green-600" />
            Reached out bars (WhatsApp)
          </h2>
          <p className="text-stone-500 text-xs mb-4">
            Bars you’ve messaged via WhatsApp. Click a row to open the conversation.
          </p>
          {whatsappConvosLoading ? (
            <p className="text-stone-500 text-sm">Loading…</p>
          ) : whatsappConversations.length === 0 ? (
            <p className="text-stone-500 text-sm">No reached-out bars yet. Use the Find bars tab to select bars and send WhatsApp.</p>
          ) : (
            <div className="flex gap-4">
              <div className="flex-1 min-w-0 overflow-x-auto rounded-xl border border-stone-200 max-h-[70vh] overflow-y-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-stone-50 border-b border-stone-200 z-10">
                    <tr className="text-left text-stone-500 uppercase tracking-wider text-xs">
                      <th className="py-2 px-2 font-medium">Bar / Phone</th>
                      <th className="py-2 px-2 font-medium">Last message</th>
                      <th className="py-2 px-2 font-medium">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {whatsappConversations.map((conv) => (
                      <tr
                        key={conv.id}
                        className={`border-b border-stone-100 cursor-pointer transition-colors ${
                          expandedConversationId === conv.id
                            ? 'bg-green-50'
                            : 'hover:bg-stone-50/50'
                        }`}
                        onClick={() =>
                          setExpandedConversationId((prev) =>
                            prev === conv.id ? null : conv.id,
                          )
                        }
                      >
                        <td className="py-3 px-2">
                          <span className="font-medium text-stone-900 block">
                            {conv.barName || conv.phone}
                          </span>
                          {conv.barName && (
                            <span className="text-stone-500 text-xs">{conv.phone}</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-stone-600 max-w-[220px] truncate" title={conv.lastMessagePreview ?? undefined}>
                          {conv.lastMessagePreview ?? '—'}
                        </td>
                        <td className="py-3 px-2 text-stone-500 whitespace-nowrap">
                          {conv.lastMessageAt ? formatDate(conv.lastMessageAt) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {expandedConversationId && (
                <div className="w-[380px] shrink-0 flex flex-col rounded-xl border border-stone-200 bg-stone-50/50 max-h-[70vh]">
                  <div className="p-3 border-b border-stone-200 flex items-center justify-between">
                    <span className="text-sm font-medium text-stone-900">
                      {whatsappConversations.find((c) => c.id === expandedConversationId)?.barName ||
                        whatsappConversations.find((c) => c.id === expandedConversationId)?.phone ||
                        'Conversation'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpandedConversationId(null)}
                      className="text-stone-400 hover:text-stone-600 text-sm"
                    >
                      Close
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {whatsappMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === 'out' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[90%] rounded-lg px-3 py-2 ${
                            msg.direction === 'out'
                              ? 'bg-green-100 text-stone-900'
                              : 'bg-white border border-stone-200 text-stone-800'
                          }`}
                        >
                          <p className="whitespace-pre-wrap text-sm">{msg.body}</p>
                          <p className="text-xs text-stone-400 mt-1">
                            {formatDate(msg.createdAt)}
                            {msg.isAiReply && ' · AI reply'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
