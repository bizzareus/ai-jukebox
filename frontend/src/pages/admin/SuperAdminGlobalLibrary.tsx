import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Music2, ListMusic } from 'lucide-react';
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
    try {
      await api.delete(`/playlists/global/songs/${songId}`);
      queryClient.invalidateQueries({ queryKey: ['playlists', 'global'] });
    } catch {
      console.error('Failed to remove from global library');
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
          Paste a playlist ID (e.g. <code className="bg-stone-100 px-1 rounded">PLxxx</code>) or a full playlist URL to add all songs to the global library.
        </p>
        <form onSubmit={handleImportPlaylist} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={playlistId}
              onChange={(e) => { setPlaylistId(e.target.value); setImportResult(null); setImportError(''); }}
              placeholder="PL... or https://www.youtube.com/playlist?list=..."
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
      {songs.length === 0 ? (
        <div className="text-center py-12 text-stone-500">
          <Music2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No songs yet. Paste a YouTube URL above to add one.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {songs.map((ps) => (
            <Card key={ps.id} className="flex items-center gap-3 p-3">
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
                className="text-stone-400 hover:text-red-600 p-1 rounded transition-colors"
                title="Remove from global library"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
