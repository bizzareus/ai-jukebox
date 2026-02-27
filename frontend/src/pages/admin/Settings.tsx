import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tag, Lock } from 'lucide-react';
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

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(false);

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

  const handleChangePassword = async () => {
    setChangePasswordError(null);
    if (newPassword.length < 8) {
      setChangePasswordError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangePasswordError('New password and confirmation do not match');
      return;
    }
    setChangePasswordLoading(true);
    try {
      await api.patch('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setChangePasswordSuccess(true);
      setTimeout(() => setChangePasswordSuccess(false), 3000);
    } catch (e) {
      setChangePasswordError(e instanceof Error ? e.message : 'Failed to change password');
    } finally {
      setChangePasswordLoading(false);
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

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-2">
          <Lock className="w-4 h-4" />
          Change password
        </h2>
        <p className="text-stone-500 text-xs mb-4">
          Update your account password. Use at least 8 characters for the new password.
        </p>
        <div className="flex flex-col gap-4">
          <Input
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
          />
          <Input
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
          />
          <Input
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
          />
          {changePasswordError && (
            <p className="text-sm text-red-600">{changePasswordError}</p>
          )}
          {changePasswordSuccess && (
            <p className="text-sm text-green-600">Password updated successfully.</p>
          )}
          <Button
            onClick={handleChangePassword}
            loading={changePasswordLoading}
            disabled={!currentPassword || !newPassword || !confirmPassword}
          >
            {changePasswordSuccess ? 'Done' : 'Change password'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
