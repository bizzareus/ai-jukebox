import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, ExternalLink } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { authService } from '../../services/auth';
import type { Venue } from '../../types';

export default function SuperAdminVenues() {
  const queryClient = useQueryClient();
  const admin = authService.getStoredAdmin();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [upiVpa, setUpiVpa] = useState('');
  const [pricePerSong, setPricePerSong] = useState(100);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const { data: venues = [] } = useQuery<Venue[]>({
    queryKey: ['venues', 'mine'],
    queryFn: () => api.get<Venue[]>('/venues/mine'),
    enabled: !!admin?.id,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      await api.post('/venues', { name, slug: slug.trim(), upiVpa: upiVpa.trim(), pricePerSong });
      queryClient.invalidateQueries({ queryKey: ['venues', 'mine'] });
      setName('');
      setSlug('');
      setUpiVpa('');
      setPricePerSong(100);
      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create venue');
    } finally {
      setCreating(false);
    }
  };

  const frontendUrl = typeof window !== 'undefined' ? `${window.location.origin}` : '';

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-bold text-stone-900">Venues</h1>
        <Button variant="primary" size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4" />
          Add venue
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 mb-5">
          <h2 className="font-semibold text-stone-900 mb-3">New venue</h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Bar" required />
            <Input label="Slug (URL)" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-bar" required />
            <Input label="UPI VPA" value={upiVpa} onChange={(e) => setUpiVpa(e.target.value)} placeholder="bar@okaxis" required />
            <Input label="Price per song (₹)" type="number" value={String(pricePerSong)} onChange={(e) => setPricePerSong(Number(e.target.value) || 100)} />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" loading={creating}>Create</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {venues.length === 0 && !showForm ? (
        <div className="text-center py-12 text-stone-500">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No venues yet</p>
          <Button variant="primary" size="sm" className="mt-3" onClick={() => setShowForm(true)}>Add your first venue</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {venues.map((v) => (
            <Card key={v.id} className="p-4 flex items-center gap-3">
              <Building2 className="w-8 h-8 text-brand-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-stone-900 truncate">{v.name}</p>
                <p className="text-stone-500 text-xs">{v.slug} · ₹{v.pricePerSong}/song</p>
              </div>
              <a href={`${frontendUrl}/${v.slug}`} target="_blank" rel="noopener noreferrer" className="text-stone-500 hover:text-brand-600 p-1" title="Open customer view">
                <ExternalLink className="w-4 h-4" />
              </a>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
