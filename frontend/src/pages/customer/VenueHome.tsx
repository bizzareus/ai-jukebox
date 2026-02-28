import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Music2, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { NowPlayingBar } from '../../components/NowPlayingBar';
import CustomerOnboarding from '../../components/CustomerOnboarding';
import { useQueue } from '../../hooks/useQueue';
import { QueueItemStatus } from '../../types';
import type { Venue, Playlist, YtSearchResult, QueueItem, Song } from '../../types';

export default function VenueHome() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<YtSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const { data: venue } = useQuery<Venue>({
    queryKey: ['venue', slug],
    queryFn: () => api.get<Venue>(`/venues/${slug}`),
    enabled: !!slug,
  });

  const { data: playlists } = useQuery<Playlist[]>({
    queryKey: ['playlists', venue?.id],
    queryFn: () => api.get<Playlist[]>(`/venues/${venue!.id}/playlists`),
    enabled: !!venue?.id,
  });

  const { data: queue = [] } = useQueue(venue?.id);

  const { data: popularSongs = [] } = useQuery<Song[]>({
    queryKey: ['venues', venue?.slug, 'songs', 'popular'],
    queryFn: () => api.get<Song[]>(`/venues/${venue!.slug}/songs/popular`),
    enabled: !!venue?.slug,
  });

  const { data: mostPlayed = [] } = useQuery<{ song: Song; playCount: number }[]>({
    queryKey: ['venues', venue?.slug, 'songs', 'most-played'],
    queryFn: () => api.get<{ song: Song; playCount: number }[]>(`/venues/${venue!.slug}/songs/most-played`),
    enabled: !!venue?.slug,
  });

  const handleSearchInput = (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) setSearchResults([]);
  };

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await api.get<YtSearchResult[]>(`/songs/search?q=${encodeURIComponent(trimmed)}`);
        setSearchResults(results ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Dynamic meta/SEO for this bar's page (e.g. /3-wise-monkeys)
  const defaultTitle = 'MuzoBox — Your bar jukebox';
  const defaultDescription = 'Request songs at the bar. Browse playlists, pick a song, pay via UPI and hear it play. MuzoBox is the jukebox for your venue.';
  useEffect(() => {
    if (!venue) return;
    const title = `${venue.name} | MuzoBox — Your bar jukebox`;
    const description = `Request songs at ${venue.name}. Pick a song, pay via UPI, hear it play. Powered by MuzoBox, the jukebox app for your bar.`;
    const url = typeof window !== 'undefined' ? window.location.href : '';

    document.title = title;

    const setMeta = (selector: string, attr: string, value: string) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute(attr, value);
    };
    setMeta('meta[name="description"]', 'content', description);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[property="og:url"]', 'content', url);
    setMeta('meta[name="twitter:title"]', 'content', title);
    setMeta('meta[name="twitter:description"]', 'content', description);

    return () => {
      document.title = defaultTitle;
      setMeta('meta[name="description"]', 'content', defaultDescription);
      setMeta('meta[property="og:title"]', 'content', defaultTitle);
      setMeta('meta[property="og:description"]', 'content', defaultDescription);
      setMeta('meta[property="og:url"]', 'content', '');
      setMeta('meta[name="twitter:title"]', 'content', defaultTitle);
      setMeta('meta[name="twitter:description"]', 'content', defaultDescription);
    };
  }, [venue]);

  if (!venue) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-stone-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  const themeColor = venue.themeColor || '#b91c1c';

  return (
    <div className="min-h-screen bg-surface pb-24">
      <CustomerOnboarding />
      {/* Header with optional cover and branding */}
      <div className="relative">
        {(venue.coverImageUrl || venue.logoUrl) && (
          <div className="h-40 bg-stone-200 overflow-hidden">
            {venue.coverImageUrl ? (
              <img src={venue.coverImageUrl} alt="" className="w-full h-full object-cover" />
            ) : venue.logoUrl ? (
              <div className="w-full h-full flex items-center justify-center bg-stone-100">
                <img src={venue.logoUrl} alt={venue.name} className="max-h-24 max-w-[200px] object-contain" />
              </div>
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-surface" />
          </div>
        )}
        <div className="px-4 pt-10 pb-6">
          <div className="flex items-center gap-2 mb-1">
            {venue.logoUrl ? (
              <img src={venue.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover border border-stone-200" />
            ) : (
              <Music2 className="w-5 h-5" style={{ color: themeColor }} />
            )}
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-sm" style={{ color: themeColor }}>MuzoBox</span>
              <span className="text-stone-500 text-xs">{venue.tagline || 'your bar jukebox'}</span>
            </div>
          </div>
          <h1 className="font-display text-3xl font-bold text-stone-900">{venue.name}</h1>
          <p className="text-stone-500 text-sm mt-1">
            Pick a song, pay{' '}
            {venue.discountAmount ? (
              <>
                <span className="line-through text-stone-400">₹{venue.pricePerSong}</span>
                <span className="font-medium" style={{ color: themeColor }}> ₹{Math.max(1, venue.pricePerSong - venue.discountAmount)}</span>
              </>
            ) : (
              <>₹{venue.pricePerSong}</>
            )}{' '}
            to queue it
          </p>
        </div>
      </div>

      {/* Up next banner */}
      <div className="px-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-stone-900 font-semibold text-sm">Up next</h2>
          <button
            type="button"
            onClick={() => navigate(`/${slug}/queue`)}
            className="text-brand-600 text-sm font-medium hover:underline"
          >
            More
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 scrollbar-hide">
          {queue.length === 0 ? (
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-stone-50 border border-stone-100 min-w-0">
              <p className="text-stone-500 text-sm whitespace-nowrap">No songs in queue</p>
            </div>
          ) : (
            (() => {
              const playing = queue.find((i) => i.status === QueueItemStatus.PLAYING);
              const pending = queue.filter((i) => i.status === QueueItemStatus.PENDING);
              const ordered: QueueItem[] = [...(playing ? [playing] : []), ...pending];
              return ordered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(`/${slug}/queue`)}
                  className="flex items-center gap-2.5 flex-shrink-0 rounded-xl bg-stone-50 border border-stone-100 px-3 py-2.5 text-left hover:bg-stone-100 active:scale-[0.98] transition-transform min-w-0 max-w-[85%]"
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-stone-200">
                    {item.song.thumbnailUrl ? (
                      <img src={item.song.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music2 className="w-4 h-4 text-stone-400" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-stone-900 text-sm font-medium truncate">{item.song.title}</p>
                    <p className="text-stone-500 text-xs">
                      {item.status === QueueItemStatus.PLAYING ? 'Now playing' : `#${item.position}`}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400 flex-shrink-0" />
                </button>
              ));
            })()
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 mb-6">
        <Input
          placeholder="Search by song name, artist, singer..."
          value={searchQuery}
          onChange={(e) => handleSearchInput(e.target.value)}
          icon={<Search className="w-4 h-4" />}
        />
      </div>

      {/* Search Results */}
      {searchQuery && (
        <div className="px-4 mb-6">
          <h2 className="text-stone-900 font-semibold mb-3">Search Results</h2>
          {searching ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : searchResults.length === 0 ? (
            <p className="text-stone-500 text-sm text-center py-6">No songs found</p>
          ) : (
            <div className="flex flex-col">
              {searchResults.map((r) => (
                <button
                  key={r.youtubeVideoId}
                  onClick={() => navigate(`/${slug}/song/${r.youtubeVideoId}?venueId=${venue.id}`, { state: { song: r } })}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-stone-50 transition-colors text-left active:scale-[0.98]"
                >
                  <img src={r.thumbnailUrl} alt={r.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-stone-900 text-sm font-medium truncate">{r.title}</p>
                    <p className="text-stone-500 text-xs truncate">{r.channelName}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Most popular & Most played - horizontal scroll */}
      {!searchQuery && (popularSongs.length > 0 || mostPlayed.length > 0) && (
        <div className="mb-6">
          {popularSongs.length > 0 && (
            <div className="mb-5">
              <h2 className="text-stone-900 font-semibold text-sm px-4 mb-2">Most popular</h2>
              <div className="flex gap-3 overflow-x-auto pb-1 px-4 -mx-1 scrollbar-hide">
                {popularSongs.map((song) => (
                  <button
                    key={song.id}
                    type="button"
                    onClick={() => navigate(`/${slug}/song/${song.youtubeVideoId}?venueId=${venue.id}`, { state: { song } })}
                    className="flex flex-col flex-shrink-0 w-28 text-left rounded-xl bg-stone-50 border border-stone-100 overflow-hidden hover:bg-stone-100 active:scale-[0.98] transition-transform"
                  >
                    <div className="w-28 h-28 bg-stone-200">
                      {song.thumbnailUrl ? (
                        <img src={song.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music2 className="w-8 h-8 text-stone-400" />
                        </div>
                      )}
                    </div>
                    <div className="p-2 min-w-0">
                      <p className="text-stone-900 text-xs font-medium line-clamp-2">{song.title}</p>
                      {song.channelName && (
                        <p className="text-stone-500 text-[10px] truncate mt-0.5">{song.channelName}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {mostPlayed.length > 0 && (
            <div>
              <h2 className="text-stone-900 font-semibold text-sm px-4 mb-2">Most played</h2>
              <div className="flex gap-3 overflow-x-auto pb-1 px-4 -mx-1 scrollbar-hide">
                {mostPlayed.map(({ song, playCount }) => (
                  <button
                    key={song.id}
                    type="button"
                    onClick={() => navigate(`/${slug}/song/${song.youtubeVideoId}?venueId=${venue.id}`, { state: { song } })}
                    className="flex flex-col flex-shrink-0 w-28 text-left rounded-xl bg-stone-50 border border-stone-100 overflow-hidden hover:bg-stone-100 active:scale-[0.98] transition-transform"
                  >
                    <div className="w-28 h-28 bg-stone-200">
                      {song.thumbnailUrl ? (
                        <img src={song.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music2 className="w-8 h-8 text-stone-400" />
                        </div>
                      )}
                    </div>
                    <div className="p-2 min-w-0">
                      <p className="text-stone-900 text-xs font-medium line-clamp-2">{song.title}</p>
                      <p className="text-stone-500 text-[10px] mt-0.5">Played {playCount}×</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Playlists */}
      {!searchQuery && (
        <div>
          <div className="px-4 mb-3">
            <h2 className="text-stone-900 font-semibold">Collections</h2>
          </div>
          <div className="flex flex-col gap-3 px-4">
            {(playlists ?? []).map((playlist) => (
              <Card
                key={playlist.id}
                glow
                className="p-4 cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => navigate(`/${slug}/playlist/${playlist.id}`)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-100 flex-shrink-0">
                    {playlist.coverImageUrl ? (
                      <img src={playlist.coverImageUrl} alt={playlist.name} className="w-full h-full object-cover" />
                    ) : playlist.playlistSongs?.[0]?.song?.thumbnailHqUrl ? (
                      <img src={playlist.playlistSongs[0].song.thumbnailHqUrl} alt={playlist.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music2 className="w-6 h-6 text-stone-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-stone-900 font-semibold font-display truncate">{playlist.name}</p>
                    {playlist.description && (
                      <p className="text-stone-500 text-xs mt-0.5 line-clamp-2">{playlist.description}</p>
                    )}
                    <p className="text-brand-600 text-xs mt-1">{playlist.playlistSongs?.length ?? 0} songs</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-stone-400 flex-shrink-0" />
                </div>
              </Card>
            ))}
            {(playlists ?? []).length === 0 && (
              <div className="text-center py-12 text-stone-500">
                <Music2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No collections yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      <NowPlayingBar queue={queue} venueId={venue.id} />
    </div>
  );
}
