import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Music2, IndianRupee, Search } from 'lucide-react';
import { api } from '../../services/api';
import { Input } from '../../components/ui/Input';
import { useQueue } from '../../hooks/useQueue';
import { NowPlayingBar } from '../../components/NowPlayingBar';
import type { Playlist, Venue } from '../../types';

export default function PlaylistView() {
  const { slug, playlistId } = useParams<{ slug: string; playlistId: string }>();
  const navigate = useNavigate();

  const { data: venue } = useQuery<Venue>({
    queryKey: ['venue', slug],
    queryFn: () => api.get<Venue>(`/venues/${slug}`),
    enabled: !!slug,
  });

  const { data: playlist } = useQuery<Playlist>({
    queryKey: ['playlist', playlistId],
    queryFn: () => api.get<Playlist>(`/playlists/${playlistId}`),
    enabled: !!playlistId,
  });

  const { data: queue = [] } = useQueue(venue?.id);

  const [searchQuery, setSearchQuery] = useState('');

  const songs = useMemo(
    () => (playlist?.playlistSongs ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
    [playlist?.playlistSongs],
  );

  const filteredSongs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter((ps) => {
      const title = ps.song?.title?.toLowerCase() ?? '';
      const artist = ps.song?.channelName?.toLowerCase() ?? '';
      return title.includes(q) || artist.includes(q);
    });
  }, [songs, searchQuery]);

  if (!playlist) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface pb-24">
      {/* Header hero */}
      <div className="relative h-48 bg-gradient-to-b from-brand-900/25 to-surface overflow-hidden">
        {playlist.coverImageUrl ? (
          <img src={playlist.coverImageUrl} alt={playlist.name} className="absolute inset-0 w-full h-full object-cover opacity-25" />
        ) : songs[0]?.song?.thumbnailHqUrl ? (
          <img src={songs[0].song.thumbnailHqUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface" />

        <button
          onClick={() => navigate(-1)}
          className="absolute top-10 left-4 p-2 rounded-full bg-white/90 backdrop-blur-sm text-stone-900 shadow-md"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="font-display text-2xl font-bold text-stone-900">{playlist.name}</h1>
          {playlist.description && (
            <p className="text-stone-600 text-sm mt-0.5 line-clamp-2">{playlist.description}</p>
          )}
          <p className="text-brand-600 text-xs mt-1">{songs.length} songs</p>
        </div>
      </div>

      {/* Search */}
      {songs.length > 0 && (
        <div className="px-4 mt-3">
          <Input
            placeholder="Search in this playlist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
        </div>
      )}

      {/* Song list */}
      <div className="px-4 mt-2">
        {songs.length === 0 ? (
          <div className="text-center py-16 text-stone-500">
            <Music2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No songs in this collection yet</p>
          </div>
        ) : filteredSongs.length === 0 ? (
          <div className="text-center py-12 text-stone-500">
            <p className="text-sm">No songs match &quot;{searchQuery}&quot;</p>
          </div>
        ) : (
          filteredSongs.map((ps, index) => (
            <button
              key={ps.id}
              onClick={() => navigate(`/${slug}/song/${ps.song.id}?venueId=${venue?.id}`, { state: { song: ps.song } })}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-stone-50 transition-colors w-full text-left active:scale-[0.98]"
            >
              <span className="text-stone-500 text-sm w-5 text-center flex-shrink-0">{index + 1}</span>
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-stone-100">
                {ps.song.thumbnailUrl ? (
                  <img src={ps.song.thumbnailUrl} alt={ps.song.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music2 className="w-4 h-4 text-stone-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-stone-900 text-sm font-medium truncate">{ps.song.title}</p>
                <p className="text-stone-500 text-xs truncate">{ps.song.artist ?? ps.song.channelName}</p>
              </div>
              <div className="flex items-center gap-1 text-brand-600 flex-shrink-0">
                <IndianRupee className="w-3.5 h-3.5" />
                {venue?.discountAmount ? (
                  <>
                    <span className="line-through text-stone-400 text-xs">{venue.pricePerSong ?? 100}</span>
                    <span className="text-sm font-semibold">{Math.max(1, (venue?.pricePerSong ?? 100) - venue.discountAmount)}</span>
                  </>
                ) : (
                  <span className="text-sm font-semibold">{venue?.pricePerSong ?? 100}</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      <NowPlayingBar queue={queue} />
    </div>
  );
}
