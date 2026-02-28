import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tag, Lock, QrCode, Download, Printer, RefreshCw, Bell } from 'lucide-react';
import * as notifications from '../../services/notifications';
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

  const [logoUrl, setLogoUrl] = useState('');
  const [logoUrlSaving, setLogoUrlSaving] = useState(false);
  const [qrRegenerating, setQrRegenerating] = useState(false);
  const [pushEnabling, setPushEnabling] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    if (venue) {
      setPricePerSong(venue.pricePerSong);
      setDiscountAmount(venue.discountAmount ?? 0);
      setLogoUrl(venue.settings?.logoUrl ?? '');
    }
  }, [venue?.id, venue?.pricePerSong, venue?.discountAmount, venue?.settings?.logoUrl]);

  const effectivePrice = Math.max(1, pricePerSong - discountAmount);
  const hasDiscount = discountAmount > 0;

  const getQrImageWithOptionalLogo = useCallback(
    (qrDataUrl: string, logoUrlOption?: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const qrImg = new Image();
        qrImg.crossOrigin = 'anonymous';
        qrImg.onload = () => {
          const size = 400;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(qrDataUrl);
            return;
          }
          ctx.drawImage(qrImg, 0, 0, size, size);
          if (logoUrlOption) {
            const logoImg = new Image();
            logoImg.crossOrigin = 'anonymous';
            logoImg.onload = () => {
              const logoSize = Math.floor(size * 0.22);
              const x = (size - logoSize) / 2;
              const y = (size - logoSize) / 2;
              ctx.fillStyle = '#fff';
              ctx.beginPath();
              ctx.arc(size / 2, size / 2, logoSize / 2 + 4, 0, Math.PI * 2);
              ctx.fill();
              ctx.drawImage(logoImg, x, y, logoSize, logoSize);
              resolve(canvas.toDataURL('image/png'));
            };
            logoImg.onerror = () => resolve(qrDataUrl);
            logoImg.src = logoUrlOption;
          } else {
            resolve(canvas.toDataURL('image/png'));
          }
        };
        qrImg.onerror = () => reject(new Error('Failed to load QR image'));
        qrImg.src = qrDataUrl;
      });
    },
    [],
  );

  const handleDownloadQr = async () => {
    if (!venue?.qrCodeUrl) return;
    try {
      const dataUrl = await getQrImageWithOptionalLogo(venue.qrCodeUrl, venue.settings?.logoUrl);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `qr-${venue.slug}.png`;
      a.click();
    } catch (e) {
      console.log('QR download failed', e);
    }
  };

  const handlePrintPoster = async () => {
    if (!venue?.qrCodeUrl) return;
    try {
      const dataUrl = await getQrImageWithOptionalLogo(venue.qrCodeUrl, venue.settings?.logoUrl);
      const win = window.open('', '_blank');
      if (!win) {
        console.log('Popup blocked');
        return;
      }
      win.document.write(`
        <!DOCTYPE html>
        <html>
          <head><title>${venue.name} - Scan to request songs</title></head>
          <body style="margin:0;padding:24px;font-family:system-ui,sans-serif;text-align:center;">
            <h1 style="font-size:1.5rem;margin-bottom:8px;">${venue.name}</h1>
            <p style="color:#666;margin-bottom:24px;">Scan to request songs</p>
            <img src="${dataUrl}" alt="QR Code" width="280" height="280" style="display:block;margin:0 auto 24px;" />
            <p style="font-size:0.875rem;color:#999;">Jukebox · Request songs at the venue</p>
          </body>
        </html>
      `);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
        win.close();
      }, 400);
    } catch (e) {
      console.log('Print poster failed', e);
    }
  };

  const handleRegenerateQr = async () => {
    if (!venue) return;
    setQrRegenerating(true);
    try {
      await api.post(`/venues/${venue.id}/qr-code`, {});
      queryClient.invalidateQueries({ queryKey: ['venue', 'current'] });
    } finally {
      setQrRegenerating(false);
    }
  };

  const handleSaveLogoUrl = async () => {
    if (!venue) return;
    setLogoUrlSaving(true);
    try {
      await api.patch(`/venues/${venue.id}`, { logoUrl: logoUrl || undefined });
      queryClient.invalidateQueries({ queryKey: ['venue', 'current'] });
    } finally {
      setLogoUrlSaving(false);
    }
  };

  const handleEnablePush = async () => {
    if (!venue?.id) return;
    setPushEnabling(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return;
      }
      const publicKey = await notifications.getVapidPublicKey();
      if (!publicKey) {
        console.log('VAPID key not configured');
        return;
      }
      const sub = await notifications.subscribeForPush(publicKey);
      if (!sub) return;
      await api.post('/notifications/subscribe', {
        venueId: venue.id,
        subscription: notifications.subscriptionToPayload(sub),
      });
      setPushEnabled(true);
    } catch (e) {
      console.log('Push enable failed', e);
    } finally {
      setPushEnabling(false);
    }
  };

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

      <Card className="p-4 mb-5">
        <h2 className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-2" data-testid="settings-qr-heading">
          <QrCode className="w-4 h-4" />
          QR Code
        </h2>
        <p className="text-stone-500 text-xs mb-4">
          Customers scan this code to open your venue page. Download or print for table tents and posters.
        </p>
        {venue.qrCodeUrl ? (
          <div className="flex flex-col items-center gap-4">
            <img
              src={venue.qrCodeUrl}
              alt="Venue QR Code"
              className="w-40 h-40 rounded-xl border border-stone-200 object-contain bg-white"
            />
            <div className="flex flex-wrap gap-2 justify-center">
              <Button variant="outline" onClick={handleDownloadQr} className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Download QR
              </Button>
              <Button variant="outline" onClick={handlePrintPoster} className="flex items-center gap-2">
                <Printer className="w-4 h-4" />
                Print poster
              </Button>
              <Button variant="outline" onClick={handleRegenerateQr} loading={qrRegenerating} className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <p className="text-stone-500 text-sm">No QR code yet.</p>
            <Button onClick={handleRegenerateQr} loading={qrRegenerating}>
              Generate QR Code
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-4 mb-5">
        <h2 className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Notifications
        </h2>
        <p className="text-stone-500 text-xs mb-4">
          Get a browser push when a new song is queued at your venue.
        </p>
        <Button variant="outline" onClick={handleEnablePush} loading={pushEnabling} disabled={pushEnabled} data-testid="settings-enable-push">
          {pushEnabled ? 'Notifications enabled' : 'Enable push notifications'}
        </Button>
      </Card>

      <Card className="p-4 mb-5">
        <h2 className="text-sm font-semibold text-stone-900 mb-3">Branding</h2>
        <p className="text-stone-500 text-xs mb-4">
          Optional logo URL. When set, the logo appears in the center of the QR code when downloading or printing.
        </p>
        <div className="flex flex-col gap-2">
          <Input
            label="Logo URL"
            type="url"
            placeholder="https://..."
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
          />
          <Button variant="outline" onClick={handleSaveLogoUrl} loading={logoUrlSaving}>
            Save logo URL
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
