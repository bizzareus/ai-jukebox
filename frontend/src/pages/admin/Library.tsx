import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, Music2, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { authService } from '../../services/auth';
import type { Playlist, YtSearchResult } from '../../types';

export default function Library() {
  const admin = authService.getStoredAdmin();
  const venueId = admin?.venueId;
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<YtSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  const [expandedPlaylist, setExpandedPlaylist] = useState<string | null>(null);

  const { data: playlists = [] } = useQuery<Playlist[]>({
    queryKey: ['playlists', venueId],
    queryFn: () => api.get<Playlist[]>(`/venues/${venueId}/playlists`),
    enabled: !!venueId,
  });

  const { data: globalPlaylist } = useQuery<Playlist>({
    queryKey: ['playlists', 'global'],
    queryFn: () => api.get<Playlist>('/playlists/global'),
    enabled: !!venueId,
  });

  const handleCreatePlaylist = async () => {
    if (!venueId || !newPlaylistName.trim()) return;
    setCreatingPlaylist(true);
    try {
      await api.post(`/venues/${venueId}/playlists`, {
        name: newPlaylistName.trim(),
        description: newPlaylistDesc.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['playlists', venueId] });
      setCreateOpen(false);
      setNewPlaylistName('');
      setNewPlaylistDesc('');
    } finally {
      setCreatingPlaylist(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await api.get<YtSearchResult[]>(`/songs/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  };

  const handleAddSong = async (playlistId: string, youtubeVideoId: string) => {
    setAddingTo(youtubeVideoId);
    try {
      await api.post(`/playlists/${playlistId}/songs`, { youtubeVideoId });
      queryClient.invalidateQueries({ queryKey: ['playlists', venueId] });
    } finally {
      setAddingTo(null);
    }
  };

  const handleRemoveSong = async (playlistId: string, songId: string) => {
    await api.delete(`/playlists/${playlistId}/songs/${songId}`);
    queryClient.invalidateQueries({ queryKey: ['playlists', venueId] });
  };

  const handleDeletePlaylist = async (id: string) => {
    if (!confirm('Delete this playlist?')) return;
    await api.delete(`/playlists/${id}`);
    queryClient.invalidateQueries({ queryKey: ['playlists', venueId] });
  };

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-bold text-stone-900">Library</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" /> New
        </Button>
      </div>

      {/* YouTube Search */}
      <Card className="p-4 mb-5">
        <h2 className="text-sm font-semibold text-stone-900 mb-3">Search YouTube</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Search songs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            icon={<Search className="w-4 h-4" />}
            className="flex-1"
          />
          <Button size="sm" onClick={handleSearch} loading={searching}>
            Search
          </Button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-3 flex flex-col gap-1">
            {searchResults.map((r) => (
              <div key={r.youtubeVideoId} className="flex items-center gap-3 p-2 rounded-xl hover:bg-stone-50">
                <img src={r.thumbnailUrl} alt={r.title} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-stone-900 text-xs font-medium truncate">{r.title}</p>
                  <p className="text-stone-500 text-xs truncate">{r.channelName}</p>
                </div>
                <select
                  onChange={(e) => e.target.value && handleAddSong(e.target.value, r.youtubeVideoId)}
                  className="text-xs bg-white border border-surface-border rounded-lg px-2 py-1.5 text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 max-w-[120px]"
                  defaultValue=""
                  disabled={addingTo === r.youtubeVideoId}
                >
                  <option value="" disabled>Add to...</option>
                  {playlists.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* From global library */}
      {globalPlaylist && (globalPlaylist.playlistSongs ?? []).length > 0 && (
        <Card className="p-4 mb-5">
          <h2 className="text-sm font-semibold text-stone-900 mb-3">From global library</h2>
          <p className="text-stone-500 text-xs mb-3">Add these songs to your playlists.</p>
          <div className="flex flex-col gap-1">
            {[...(globalPlaylist.playlistSongs ?? [])]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((ps) => (
                <div key={ps.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-stone-50">
                  {ps.song?.thumbnailUrl ? (
                    <img src={ps.song.thumbnailUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                      <Music2 className="w-4 h-4 text-stone-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-stone-900 text-xs font-medium truncate">{ps.song?.title ?? '—'}</p>
                    <p className="text-stone-500 text-xs truncate">{ps.song?.channelName ?? ps.song?.youtubeVideoId}</p>
                  </div>
                  <select
                    onChange={(e) => {
                      const id = e.target.value;
                      if (id && ps.song?.youtubeVideoId) handleAddSong(id, ps.song.youtubeVideoId);
                    }}
                    className="text-xs bg-white border border-surface-border rounded-lg px-2 py-1.5 text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 max-w-[120px]"
                    defaultValue=""
                    disabled={addingTo === ps.song?.youtubeVideoId}
                  >
                    <option value="" disabled>Add to...</option>
                    {playlists.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Playlists */}
      <div className="flex flex-col gap-3">
        {playlists.map((playlist) => (
          <Card key={playlist.id} className="overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                {playlist.playlistSongs?.[0]?.song?.thumbnailUrl ? (
                  <img src={playlist.playlistSongs[0].song.thumbnailUrl} alt="" className="w-full h-full rounded-lg object-cover" />
                ) : (
                  <Music2 className="w-4 h-4 text-stone-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-stone-900 font-medium truncate">{playlist.name}</p>
                <p className="text-stone-500 text-xs">{playlist.playlistSongs?.length ?? 0} songs</p>
              </div>
              <button
                onClick={() => setExpandedPlaylist(expandedPlaylist === playlist.id ? null : playlist.id)}
                className="text-stone-400 p-1"
              >
                {expandedPlaylist === playlist.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button onClick={() => handleDeletePlaylist(playlist.id)} className="text-stone-500 hover:text-red-600 p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {expandedPlaylist === playlist.id && (
              <div className="border-t border-surface-border px-3 pb-2">
                {(playlist.playlistSongs ?? []).map((ps) => (
                  <div key={ps.id} className="flex items-center gap-2 py-2">
                    <img src={ps.song.thumbnailUrl ?? ''} alt={ps.song.title} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                    <p className="flex-1 text-xs text-stone-900 truncate">{ps.song.title}</p>
                    <button
                      onClick={() => handleRemoveSong(playlist.id, ps.song.id)}
                      className="text-stone-500 hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {(playlist.playlistSongs ?? []).length === 0 && (
                  <p className="text-stone-500 text-xs py-3 text-center">No songs yet</p>
                )}
              </div>
            )}
          </Card>
        ))}
        {playlists.length === 0 && (
          <div className="text-center py-12 text-stone-500">
            <Music2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No playlists yet</p>
          </div>
        )}
      </div>

      {/* Create Playlist Sheet */}
      <BottomSheet open={createOpen} onClose={() => setCreateOpen(false)} title="New Collection">
        <div className="flex flex-col gap-4 mt-2">
          <Input
            label="Name"
            placeholder="e.g. Bollywood Hits"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
          />
          <Input
            label="Description (optional)"
            placeholder="A short description..."
            value={newPlaylistDesc}
            onChange={(e) => setNewPlaylistDesc(e.target.value)}
          />
          <Button onClick={handleCreatePlaylist} loading={creatingPlaylist} size="lg">
            Create Collection
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
