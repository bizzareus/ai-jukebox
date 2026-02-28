import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Music2, ListMusic, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import type { Playlist } from '../../types';

export default function SuperAdminCollections() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addError, setAddError] = useState('');
  const [playlistId, setPlaylistId] = useState('');
  const [importingTo, setImportingTo] = useState<string | null>(null);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState<{ added: number; skipped: number; errors: string[] } | null>(null);
  const [lastImportCollectionId, setLastImportCollectionId] = useState<string | null>(null);

  const { data: collections = [], isLoading } = useQuery<Playlist[]>({
    queryKey: ['playlists', 'global-collections'],
    queryFn: () => api.get<Playlist[]>('/playlists/global-collections'),
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setAddError('');
    try {
      await api.post('/playlists/global-collections', {
        name: newName.trim(),
        description: newDescription.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['playlists', 'global-collections'] });
      setCreateOpen(false);
      setNewName('');
      setNewDescription('');
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  const handleAddSong = async (collectionId: string) => {
    if (!youtubeUrl.trim()) return;
    setAddingTo(collectionId);
    setAddError('');
    try {
      await api.post(`/playlists/global-collections/${collectionId}/songs`, {
        youtubeUrl: youtubeUrl.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ['playlists', 'global-collections'] });
      setYoutubeUrl('');
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to add song');
    } finally {
      setAddingTo(null);
    }
  };

  const handleImportPlaylist = async (collectionId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistId.trim()) return;
    setImportingTo(collectionId);
    setImportError('');
    setImportResult(null);
    try {
      const result = await api.post<{ added: number; skipped: number; errors: string[] }>(
        `/playlists/global-collections/${collectionId}/songs/by-playlist`,
        { youtubePlaylistId: playlistId.trim() },
      );
      setImportResult(result ?? { added: 0, skipped: 0, errors: [] });
      setLastImportCollectionId(collectionId);
      queryClient.invalidateQueries({ queryKey: ['playlists', 'global-collections'] });
      setPlaylistId('');
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Failed to import');
    } finally {
      setImportingTo(null);
    }
  };

  const handleRemoveSong = async (collectionId: string, songId: string) => {
    try {
      await api.delete(`/playlists/global-collections/${collectionId}/songs/${songId}`);
      queryClient.invalidateQueries({ queryKey: ['playlists', 'global-collections'] });
    } catch {
      console.error('Failed to remove song');
    }
  };

  const songCount = (p: Playlist) => p.playlistSongs?.length ?? 0;

  return (
    <div className="px-4 pt-6 pb-4">
      <h1 className="font-display text-2xl font-bold text-stone-900 mb-1">Collections</h1>
      <p className="text-stone-500 text-sm mb-5">
        Create collections and add music. Bar admins can then import a collection as-is into their venue.
      </p>

      {!createOpen ? (
        <Button className="mb-4" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" />
          Create collection
        </Button>
      ) : (
        <Card className="p-4 mb-4">
          <h2 className="font-semibold text-stone-900 mb-3">New collection</h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Collection name"
              className="w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-sm"
            />
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              className="w-full bg-white border border-surface-border rounded-xl px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-sm"
            />
            {addError && <p className="text-red-600 text-sm">{addError}</p>}
            <div className="flex gap-2">
              <Button type="submit" loading={creating} disabled={!newName.trim()}>
                Create
              </Button>
              <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); setAddError(''); }}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : collections.length === 0 ? (
        <div className="text-center py-12 text-stone-500">
          <ListMusic className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No collections yet. Create one above.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {collections.map((col) => {
            const isExpanded = expandedId === col.id;
            const songs = [...(col.playlistSongs ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
            return (
              <Card key={col.id} className="overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-stone-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : col.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-stone-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-stone-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-stone-900 truncate">{col.name}</p>
                    <p className="text-stone-500 text-xs">{songCount(col)} songs</p>
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-stone-100 space-y-4">
                    <div className="pt-4">
                      <h3 className="text-sm font-medium text-stone-700 mb-2">Add song by YouTube URL</h3>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={youtubeUrl}
                          onChange={(e) => setYoutubeUrl(e.target.value)}
                          placeholder="https://youtube.com/watch?v=..."
                          className="flex-1 bg-white border border-surface-border rounded-xl px-4 py-2 text-stone-900 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleAddSong(col.id)}
                          loading={addingTo === col.id}
                          disabled={!youtubeUrl.trim()}
                        >
                          Add
                        </Button>
                      </div>
                      {addError && addingTo === col.id && <p className="text-red-600 text-xs mt-1">{addError}</p>}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-stone-700 mb-2">Import from YouTube playlist</h3>
                      <form onSubmit={(e) => handleImportPlaylist(col.id, e)} className="flex gap-2">
                        <input
                          type="text"
                          value={playlistId}
                          onChange={(e) => { setPlaylistId(e.target.value); setImportResult(null); setImportError(''); }}
                          placeholder="youtube.com or music.youtube.com playlist URL"
                          className="flex-1 bg-white border border-surface-border rounded-xl px-4 py-2 text-stone-900 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                        />
                        <Button type="submit" size="sm" loading={importingTo === col.id} disabled={!playlistId.trim()}>
                          Import
                        </Button>
                      </form>
                      {importError && importingTo === col.id && <p className="text-red-600 text-xs mt-1">{importError}</p>}
                      {importResult && lastImportCollectionId === col.id && (
                        <p className="text-stone-600 text-xs mt-1">
                          Last import: {importResult.added} added, {importResult.skipped} skipped.
                        </p>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
                        Songs ({songs.length})
                      </h3>
                      {songs.length === 0 ? (
                        <p className="text-stone-500 text-sm">No songs yet.</p>
                      ) : (
                        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                          {songs.map((ps) => (
                            <div
                              key={ps.id}
                              className="flex items-center gap-2 py-2 border-b border-stone-50 last:border-0"
                            >
                              {ps.song?.thumbnailUrl ? (
                                <img src={ps.song.thumbnailUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded bg-stone-100 flex items-center justify-center shrink-0">
                                  <Music2 className="w-3 h-3 text-stone-400" />
                                </div>
                              )}
                              <span className="flex-1 text-sm text-stone-900 truncate">{ps.song?.title ?? '—'}</span>
                              <button
                                type="button"
                                onClick={() => ps.song?.id && handleRemoveSong(col.id, ps.song.id)}
                                className="text-stone-400 hover:text-red-600 p-1"
                                aria-label="Remove"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
