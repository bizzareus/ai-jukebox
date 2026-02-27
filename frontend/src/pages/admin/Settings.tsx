import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IndianRupee, Tag } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { authService } from '../../services/auth';
import type { Venue } from '../../types';

export default function Settings() {
  const queryClient = useQueryClient();
  const admin = authService.getStoredAdmin();

  const { data: venue, isLoading } = useQuery<Venue>({
    queryKey: ['venue', 'current'],
    queryFn: () => api.get<Venue>('/venues/current'),
    enabled: !!admin?.venueId,
  });

  const [pricePerSong, setPricePerSong] = useState(100);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (venue) {
      setPricePerSong(venue.pricePerSong);
      setDiscountAmount(venue.discountAmount ?? 0);
    }
  }, [venue?.id, venue?.pricePerSong, venue?.discountAmount]);

  const effectivePrice = Math.max(1, pricePerSong - discountAmount);
  const hasDiscount = discountAmount > 0;

  const handleSave = async () => {
    if (!venue) return;
    setSaving(true);
    setSaved(false);
    try {
      await api.patch(`/venues/${venue.id}`, {
        pricePerSong: pricePerSong >= 1 ? pricePerSong : 100,
        discountAmount: Math.min(discountAmount, pricePerSong),
      });
      queryClient.invalidateQueries({ queryKey: ['venue', 'current'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (!admin?.venueId) {
    return (
      <div className="px-4 pt-6 pb-4">
        <p className="text-stone-500 text-sm">No venue assigned.</p>
      </div>
    );
  }

  if (isLoading || !venue) {
    return (
      <div className="px-4 pt-6 pb-4 flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-4">
      <h1 className="font-display text-2xl font-bold text-stone-900 mb-1">Settings</h1>
      <p className="text-stone-500 text-sm mb-5">{venue.name}</p>

      <Card className="p-4 mb-5">
        <h2 className="text-sm font-semibold text-stone-900 mb-3">Pricing</h2>
        <p className="text-stone-500 text-xs mb-4">
          Set the price per song and an optional flat discount (₹ off). Customers see the discounted price.
        </p>
        <div className="flex flex-col gap-4">
          <Input
            label="Price per song (₹)"
            type="number"
            min={1}
            value={String(pricePerSong)}
            onChange={(e) => setPricePerSong(Math.max(0, Number(e.target.value) || 0))}
          />
          <Input
            label="Flat discount (₹ off)"
            type="number"
            min={0}
            max={pricePerSong}
            placeholder="0"
            value={discountAmount === 0 ? '' : String(discountAmount)}
            onChange={(e) => {
              const v = Math.max(0, Number(e.target.value) || 0);
              setDiscountAmount(Math.min(v, pricePerSong));
            }}
          />
          {hasDiscount && (
            <div className="flex items-center gap-2 text-sm text-stone-600 bg-brand-50 rounded-xl p-3">
              <Tag className="w-4 h-4 text-brand-600 shrink-0" />
              <span>
                Customer pays <strong>₹{effectivePrice}</strong>
                {effectivePrice < pricePerSong && (
                  <> (was ₹{pricePerSong})</>
                )}
              </span>
            </div>
          )}
          <Button onClick={handleSave} loading={saving}>
            {saved ? 'Saved' : 'Save'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
