import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Music2, ListMusic, Search, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import type { Playlist } from '../../types';

export default function SuperAdminGlobalLibrary() {
  const queryClient = useQueryClient();
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [playlistId, setPlaylistId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState<{ added: number; skipped: number; errors: string[] } | null>(null);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: globalPlaylist } = useQuery<Playlist>({
    queryKey: ['playlists', 'global'],
    queryFn: () => api.get<Playlist>('/playlists/global'),
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!youtubeUrl.trim()) return;
    setAdding(true);
    try {
      await api.post('/playlists/global/songs', { youtubeUrl: youtubeUrl.trim() });
      queryClient.invalidateQueries({ queryKey: ['playlists', 'global'] });
      setYoutubeUrl('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add song');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (songId: string) => {
    setDeletingId(songId);
    try {
      await api.delete(`/playlists/global/songs/${songId}`);
      queryClient.invalidateQueries({ queryKey: ['playlists', 'global'] });
    } catch {
      console.error('Failed to remove from global library');
    } finally {
      setDeletingId(null);
    }
  };

  const handleImportPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError('');
    setImportResult(null);
    if (!playlistId.trim()) return;
    setImporting(true);
    try {
      const result = await api.post<{ added: number; skipped: number; errors: string[] }>(
        '/playlists/global/songs/by-playlist',
        { youtubePlaylistId: playlistId.trim() },
      );
      setImportResult(result ?? { added: 0, skipped: 0, errors: [] });
      queryClient.invalidateQueries({ queryKey: ['playlists', 'global'] });
      setPlaylistId('');
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Failed to import playlist');
    } finally {
      setImporting(false);
    }
  };

  const songs = (globalPlaylist?.playlistSongs ?? []).sort((a, b) => a.sortOrder - b.sortOrder);

  const searchLower = search.trim().toLowerCase();
  const filteredSongs = useMemo(() => {
    if (!searchLower) return songs;
    return songs.filter((ps) => {
      const title = ps.song?.title?.toLowerCase() ?? '';
      const channel = ps.song?.channelName?.toLowerCase() ?? '';
      const videoId = ps.song?.youtubeVideoId?.toLowerCase() ?? '';
      return title.includes(searchLower) || channel.includes(searchLower) || videoId.includes(searchLower);
    });
  }, [songs, searchLower]);

  const toggleSelect = (songId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size >= filteredSongs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSongs.map((ps) => ps.song?.id).filter(Boolean) as string[]));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      await Promise.all([...selectedIds].map((id) => api.delete(`/playlists/global/songs/${id}`)));
      queryClient.invalidateQueries({ queryKey: ['playlists', 'global'] });
      setSelectedIds(new Set());
    } catch {
      console.error('Bulk delete failed');
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-4">
      <h1 className="font-display text-2xl font-bold text-stone-900 mb-1">Global Library</h1>
      <p className="text-stone-500 text-sm mb-5">Songs here can be added by any venue to their playlists.</p>

      <Card className="p-4 mb-4">
        <h2 className="font-semibold text-stone-900 mb-3">Add song by YouTube URL</h2>
        <form onSubmit={handleAdd} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
              className="flex-1 bg-white border border-surface-border rounded-xl px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-sm"
            />
            <Button type="submit" loading={adding} disabled={!youtubeUrl.trim()}>
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </form>
      </Card>

      <Card className="p-4 mb-5">
        <h2 className="font-semibold text-stone-900 mb-3">Import from YouTube playlist</h2>
        <p className="text-stone-500 text-sm mb-3">
          Paste a playlist ID (e.g. <code className="bg-stone-100 px-1 rounded">PLxxx</code>) or a link from YouTube or YouTube Music to add all songs.
        </p>
        <form onSubmit={handleImportPlaylist} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={playlistId}
              onChange={(e) => { setPlaylistId(e.target.value); setImportResult(null); setImportError(''); }}
              placeholder="youtube.com/playlist?list=... or music.youtube.com/playlist?list=..."
              className="flex-1 bg-white border border-surface-border rounded-xl px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-sm"
            />
            <Button type="submit" loading={importing} disabled={!playlistId.trim()}>
              <ListMusic className="w-4 h-4" />
              Import
            </Button>
          </div>
          {importError && <p className="text-red-600 text-sm">{importError}</p>}
          {importResult && (
            <p className="text-stone-600 text-sm">
              Added <strong>{importResult.added}</strong>, skipped (already in library) <strong>{importResult.skipped}</strong>
              {importResult.errors.length > 0 && `, ${importResult.errors.length} failed`}.
              {importResult.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-brand-600 text-xs">Show errors</summary>
                  <pre className="mt-1 text-xs text-stone-500 overflow-auto max-h-24">{importResult.errors.join('\n')}</pre>
                </details>
              )}
            </p>
          )}
        </form>
      </Card>

      <h2 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">Songs in global library ({songs.length})</h2>

      {songs.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, channel, or video ID..."
              className="w-full bg-white border border-surface-border rounded-xl pl-9 pr-4 py-2.5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-sm"
            />
          </div>
          {filteredSongs.length > 0 && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={filteredSongs.length > 0 && selectedIds.size === filteredSongs.length}
                  onChange={toggleSelectAll}
                  className="rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                />
                Select all
              </label>
              {selectedIds.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDelete}
                  loading={bulkDeleting}
                  className="!text-red-600 hover:!bg-red-50 hover:!border-red-200"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete {selectedIds.size} selected
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {songs.length === 0 ? (
        <div className="text-center py-12 text-stone-500">
          <Music2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No songs yet. Paste a YouTube URL above to add one.</p>
        </div>
      ) : filteredSongs.length === 0 ? (
        <div className="text-center py-8 text-stone-500 text-sm">No songs match your search.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredSongs.map((ps) => (
            <Card key={ps.id} className="flex items-center gap-3 p-3">
              {ps.song?.id && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(ps.song.id)}
                  onChange={() => toggleSelect(ps.song!.id)}
                  className="rounded border-stone-300 text-brand-600 focus:ring-brand-500 flex-shrink-0"
                  aria-label={`Select ${ps.song?.title ?? 'song'}`}
                />
              )}
              {ps.song?.thumbnailUrl ? (
                <img src={ps.song.thumbnailUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                  <Music2 className="w-4 h-4 text-stone-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-stone-900 text-sm font-medium truncate">{ps.song?.title ?? '—'}</p>
                <p className="text-stone-500 text-xs truncate">{ps.song?.channelName ?? ps.song?.youtubeVideoId}</p>
              </div>
              <button
                type="button"
                onClick={() => ps.song?.id && handleRemove(ps.song.id)}
                disabled={deletingId === ps.song?.id}
                className="text-stone-400 hover:text-red-600 p-1 rounded transition-colors disabled:opacity-70 disabled:pointer-events-none"
                title="Remove from global library"
              >
                {deletingId === ps.song?.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
