import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tag, Lock, QrCode, Printer, RefreshCw, Bell } from "lucide-react";
import * as notifications from "../../services/notifications";
import { api } from "../../services/api";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { authService } from "../../services/auth";
import type { Venue } from "../../types";

export default function Settings() {
  const queryClient = useQueryClient();
  const admin = authService.getStoredAdmin();

  const { data: venue, isLoading } = useQuery<Venue>({
    queryKey: ["venue", "current"],
    queryFn: () => api.get<Venue>("/venues/current"),
    enabled: !!admin?.venueId,
  });

  const [pricePerSong, setPricePerSong] = useState(100);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState<string | null>(
    null,
  );
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(false);

  const [logoUrl, setLogoUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [themeColor, setThemeColor] = useState("");
  const [tagline, setTagline] = useState("");
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [democraticMode, setDemocraticMode] = useState(false);
  const [democraticModeSaving, setDemocraticModeSaving] = useState(false);
  const [qrRegenerating, setQrRegenerating] = useState(false);
  const [pushEnabling, setPushEnabling] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    if (venue) {
      setPricePerSong(venue.pricePerSong);
      setDiscountAmount(venue.discountAmount ?? 0);
      setLogoUrl(venue.logoUrl ?? venue.settings?.logoUrl ?? "");
      setCoverImageUrl(venue.coverImageUrl ?? "");
      setThemeColor(venue.themeColor ?? "");
      setTagline(venue.tagline ?? "");
      setDemocraticMode(venue.settings?.democraticMode ?? false);
    }
  }, [venue]);

  const effectivePrice = Math.max(1, pricePerSong - discountAmount);
  const hasDiscount = discountAmount > 0;

  const getQrImageWithOptionalLogo = useCallback(
    (qrDataUrl: string, logoUrlOption?: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const qrImg = new Image();
        qrImg.crossOrigin = "anonymous";
        qrImg.onload = () => {
          const size = 400;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(qrDataUrl);
            return;
          }
          ctx.drawImage(qrImg, 0, 0, size, size);
          if (logoUrlOption) {
            const logoImg = new Image();
            logoImg.crossOrigin = "anonymous";
            logoImg.onload = () => {
              const logoSize = Math.floor(size * 0.22);
              const x = (size - logoSize) / 2;
              const y = (size - logoSize) / 2;
              ctx.fillStyle = "#fff";
              ctx.beginPath();
              ctx.arc(size / 2, size / 2, logoSize / 2 + 4, 0, Math.PI * 2);
              ctx.fill();
              ctx.drawImage(logoImg, x, y, logoSize, logoSize);
              resolve(canvas.toDataURL("image/png"));
            };
            logoImg.onerror = () => resolve(qrDataUrl);
            logoImg.src = logoUrlOption;
          } else {
            resolve(canvas.toDataURL("image/png"));
          }
        };
        qrImg.onerror = () => reject(new Error("Failed to load QR image"));
        qrImg.src = qrDataUrl;
      });
    },
    [],
  );

  const handleGeneratePoster = async () => {
    if (!venue?.qrCodeUrl) return;
    try {
      const dataUrl = await getQrImageWithOptionalLogo(
        venue.qrCodeUrl,
        venue.logoUrl ?? venue.settings?.logoUrl,
      );
      const win = window.open("", "_blank");
      if (!win) {
        console.log("Popup blocked");
        return;
      }
      win.document.write(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <title>Scan to play - ${venue.name}</title>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet" />
            <style>
              :root {
                --color-surface: #FAFAF9;
                --color-surface-card: #FFFFFF;
                --color-ink: #1C1917;
                --color-ink-muted: #78716C;
                --color-surface-border: #E7E5E4;
                --color-brand: #b91c1c;
                --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
                --font-display: 'Playfair Display', Georgia, serif;
              }
              * { box-sizing: border-box; }
              @page { size: A4; margin: 0; }
              body {
                margin: 0;
                min-height: 100vh;
                background: var(--color-surface);
                color: var(--color-ink);
                font-family: var(--font-sans);
                font-size: 16px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 48px 24px;
                text-align: center;
              }
              @media print {
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .print-tip { display: none !important; }
              }
              .poster-card {
                background: var(--color-surface-card);
                border: 1px solid var(--color-surface-border);
                border-radius: 16px;
                padding: 40px 44px 36px;
                max-width: 440px;
                box-shadow: 0 4px 14px rgba(0,0,0,0.06);
              }
              @media print {
                .poster-card { box-shadow: none; border-radius: 0; border: none; }
              }
              .poster-accent {
                width: 48px;
                height: 3px;
                background: var(--color-brand);
                margin: 0 auto 24px;
                border-radius: 2px;
              }
              .poster-badge {
                display: inline-block;
                font-size: 0.6875rem;
                font-weight: 600;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                color: var(--color-brand);
                margin-bottom: 12px;
              }
              .poster-title {
                font-family: var(--font-display);
                font-size: 1.875rem;
                font-weight: 600;
                color: var(--color-ink);
                margin: 0 0 8px;
                line-height: 1.25;
                letter-spacing: -0.02em;
              }
              .poster-subtitle {
                font-family: var(--font-sans);
                font-size: 0.9375rem;
                font-weight: 500;
                color: var(--color-ink-muted);
                margin: 0 0 28px;
                line-height: 1.4;
              }
              .poster-qr-wrap {
                background: var(--color-surface);
                border-radius: 12px;
                padding: 20px;
                display: inline-block;
                margin-bottom: 20px;
              }
              .poster-qr {
                display: block;
                width: 260px;
                height: 260px;
              }
              .poster-instruction {
                font-size: 0.8125rem;
                color: var(--color-ink-muted);
                margin: 0 0 24px;
                line-height: 1.45;
              }
              .poster-footer {
                font-family: var(--font-sans);
                font-size: 0.875rem;
                font-weight: 500;
                color: var(--color-ink-muted);
                margin: 0;
              }
              .print-tip {
                font-size: 0.8125rem;
                color: var(--color-ink-muted);
                margin: 0 0 20px;
              }
            </style>
          </head>
          <body>
            <p class="print-tip">In the print dialog, turn off <strong>Headers and footers</strong> for a clean poster.</p>
            <div class="poster-card">
              <div class="poster-accent"></div>
              <p class="poster-badge">Bar jukebox</p>
              <h1 class="poster-title">Scan to play your own music</h1>
              <p class="poster-subtitle">Pick songs from your phone and they play here</p>
              <div class="poster-qr-wrap">
                <img class="poster-qr" src="${dataUrl}" alt="QR Code" width="260" height="260" />
              </div>
              <p class="poster-instruction">Scan the QR code with your phone camera to add songs to the queue.</p>
              <p class="poster-footer">By Muzo Box</p>
            </div>
          </body>
        </html>
      `);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
        win.close();
      }, 600);
    } catch (e) {
      console.log("Generate poster failed", e);
    }
  };

  const handleRegenerateQr = async () => {
    if (!venue) return;
    setQrRegenerating(true);
    try {
      await api.post(`/venues/${venue.id}/qr-code`, {});
      queryClient.invalidateQueries({ queryKey: ["venue", "current"] });
    } finally {
      setQrRegenerating(false);
    }
  };

  const handleSaveBranding = async () => {
    if (!venue) return;
    setBrandingSaving(true);
    try {
      await api.patch(`/venues/${venue.id}`, {
        logoUrl: logoUrl || undefined,
        coverImageUrl: coverImageUrl || undefined,
        themeColor: themeColor || undefined,
        tagline: tagline || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["venue", "current"] });
    } finally {
      setBrandingSaving(false);
    }
  };

  const handleSaveDemocraticMode = async () => {
    if (!venue) return;
    setDemocraticModeSaving(true);
    try {
      await api.patch(`/venues/${venue.id}`, { democraticMode: democraticMode });
      queryClient.invalidateQueries({ queryKey: ["venue", "current"] });
    } finally {
      setDemocraticModeSaving(false);
    }
  };

  const handleEnablePush = async () => {
    if (!venue?.id) return;
    setPushEnabling(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.log("Notification permission denied");
        return;
      }
      const publicKey = await notifications.getVapidPublicKey();
      if (!publicKey) {
        console.log("VAPID key not configured");
        return;
      }
      const sub = await notifications.subscribeForPush(publicKey);
      if (!sub) return;
      await api.post("/notifications/subscribe", {
        venueId: venue.id,
        subscription: notifications.subscriptionToPayload(sub),
      });
      setPushEnabled(true);
    } catch (e) {
      console.log("Push enable failed", e);
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
      queryClient.invalidateQueries({ queryKey: ["venue", "current"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setChangePasswordError(null);
    if (newPassword.length < 8) {
      setChangePasswordError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangePasswordError("New password and confirmation do not match");
      return;
    }
    setChangePasswordLoading(true);
    try {
      await api.patch("/auth/change-password", {
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setChangePasswordSuccess(true);
      setTimeout(() => setChangePasswordSuccess(false), 3000);
    } catch (e) {
      setChangePasswordError(
        e instanceof Error ? e.message : "Failed to change password",
      );
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
      <h1 className="font-display text-2xl font-bold text-stone-900 mb-1">
        Settings
      </h1>
      <p className="text-stone-500 text-sm mb-5">{venue.name}</p>

      <Card className="p-4 mb-5">
        <h2 className="text-sm font-semibold text-stone-900 mb-3">Pricing</h2>
        <p className="text-stone-500 text-xs mb-4">
          Set the price per song and an optional flat discount (₹ off).
          Customers see the discounted price.
        </p>
        <div className="flex flex-col gap-4">
          <Input
            label="Price per song (₹)"
            type="number"
            min={1}
            value={String(pricePerSong)}
            onChange={(e) =>
              setPricePerSong(Math.max(0, Number(e.target.value) || 0))
            }
          />
          <Input
            label="Flat discount (₹ off)"
            type="number"
            min={0}
            max={pricePerSong}
            placeholder="0"
            value={discountAmount === 0 ? "" : String(discountAmount)}
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
                {effectivePrice < pricePerSong && <> (was ₹{pricePerSong})</>}
              </span>
            </div>
          )}
          <Button onClick={handleSave} loading={saving}>
            {saved ? "Saved" : "Save"}
          </Button>
        </div>
      </Card>

      <Card className="p-4 mb-5">
        <h2 className="text-sm font-semibold text-stone-900 mb-3">Queue mode</h2>
        <p className="text-stone-500 text-xs mb-4">
          Democratic mode: customers can upvote pending songs; the most upvoted
          songs play first. When off, queue order is first-come first-served.
        </p>
        <div className="flex items-center gap-3 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={democraticMode}
              onChange={(e) => setDemocraticMode(e.target.checked)}
              className="accent-brand-600 w-4 h-4"
            />
            <span className="text-sm text-stone-700">Democratic mode (votes determine order)</span>
          </label>
        </div>
        <Button
          variant="outline"
          onClick={handleSaveDemocraticMode}
          loading={democraticModeSaving}
        >
          Save queue mode
        </Button>
      </Card>

      <Card className="p-4 mb-5">
        <h2
          className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-2"
          data-testid="settings-qr-heading"
        >
          <QrCode className="w-4 h-4" />
          QR Code
        </h2>
        <p className="text-stone-500 text-xs mb-4">
          Customers scan this code to open your venue page. Generate a poster to
          print and stick at the bar or give to customers.
        </p>
        {venue.qrCodeUrl ? (
          <div className="flex flex-col items-center gap-4">
            <img
              src={venue.qrCodeUrl}
              alt="Venue QR Code"
              className="w-40 h-40 rounded-xl border border-stone-200 object-contain bg-white"
            />
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                variant="outline"
                onClick={handleGeneratePoster}
                className="flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Generate poster
              </Button>
              <Button
                variant="outline"
                onClick={handleRegenerateQr}
                loading={qrRegenerating}
                className="flex items-center gap-2"
              >
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
        <Button
          variant="outline"
          onClick={handleEnablePush}
          loading={pushEnabling}
          disabled={pushEnabled}
          data-testid="settings-enable-push"
        >
          {pushEnabled ? "Notifications enabled" : "Enable push notifications"}
        </Button>
      </Card>

      <Card className="p-4 mb-5">
        <h2 className="text-sm font-semibold text-stone-900 mb-3">Branding</h2>
        <p className="text-stone-500 text-xs mb-4">
          Logo, cover image, tagline and theme color for your venue page. Logo
          also appears in the center of the QR code when printing.
        </p>
        <div className="flex flex-col gap-4">
          <Input
            label="Logo URL"
            type="url"
            placeholder="https://..."
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
          />
          <Input
            label="Cover image URL"
            type="url"
            placeholder="https://..."
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
          />
          <Input
            label="Tagline"
            type="text"
            placeholder="e.g. Your bar jukebox"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />
          <div>
            <label className="block text-sm text-stone-700 mb-1.5">Theme color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={themeColor || "#b91c1c"}
                onChange={(e) => setThemeColor(e.target.value)}
                className="w-10 h-10 rounded border border-stone-200 cursor-pointer"
                title="Theme color"
                aria-label="Theme color picker"
              />
              <input
                type="text"
                placeholder="#b91c1c"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="flex-1 bg-white border border-surface-border rounded-xl px-4 py-3 text-stone-900 text-sm"
              />
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleSaveBranding}
            loading={brandingSaving}
          >
            Save branding
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-2">
          <Lock className="w-4 h-4" />
          Change password
        </h2>
        <p className="text-stone-500 text-xs mb-4">
          Update your account password. Use at least 8 characters for the new
          password.
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
            <p className="text-sm text-green-600">
              Password updated successfully.
            </p>
          )}
          <Button
            onClick={handleChangePassword}
            loading={changePasswordLoading}
            disabled={!currentPassword || !newPassword || !confirmPassword}
          >
            {changePasswordSuccess ? "Done" : "Change password"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
