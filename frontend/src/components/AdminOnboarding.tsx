import { useState } from 'react';
import {
  LayoutDashboard,
  Music2,
  Library,
  Settings,
  QrCode,
  Sparkles,
} from 'lucide-react';
import { Button } from './ui/Button';
import { markOnboardingSeen } from './adminOnboarding.helpers';

const steps = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    description:
      'See today’s earnings, songs played, and what’s in the queue. Your hub at a glance.',
  },
  {
    icon: Music2,
    title: 'DJ Mode',
    description:
      'Control what’s playing. Skip, reorder, or play from the queue. Perfect when you’re running the music.',
  },
  {
    icon: Library,
    title: 'Library',
    description:
      'Your venue’s playlists and songs. Add or edit playlists so customers can browse and request.',
  },
  {
    icon: QrCode,
    title: 'Customers use a QR code',
    description:
      'Guests scan your venue’s QR (in Settings), pick a song, pay via UPI, and their request joins the queue.',
  },
  {
    icon: Settings,
    title: 'Settings',
    description:
      'Set price per song, UPI details, and get your QR code. Share the QR so customers can start requesting.',
  },
];

export default function AdminOnboarding() {
  const [visible, setVisible] = useState(true);

  const handleDismiss = () => {
    markOnboardingSeen();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes admin-onboarding-fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes admin-onboarding-fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes admin-onboarding-scaleIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes admin-onboarding-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-sm"
        style={{ animation: 'admin-onboarding-fadeIn 0.3s ease-out' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-onboarding-title"
      >
        <div
          className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden max-h-[90vh] flex flex-col"
          style={{
            animation: 'admin-onboarding-scaleIn 0.35s ease-out 0.05s both',
          }}
        >
          <div className="relative px-6 pt-8 pb-6 bg-gradient-to-br from-brand-500 to-brand-700 text-white flex-shrink-0">
            <div
              className="relative flex justify-center mb-4"
              style={{ animation: 'admin-onboarding-float 2.5s ease-in-out infinite' }}
            >
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur">
                <Sparkles className="w-8 h-8" />
              </div>
            </div>
            <h2
              id="admin-onboarding-title"
              className="relative text-center font-display text-xl font-bold"
            >
              Welcome to your jukebox
            </h2>
            <p className="relative text-center text-white/90 text-sm mt-1">
              Here’s how to run it
            </p>
          </div>

          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1 min-h-0">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={i}
                  className="flex gap-3 items-start"
                  style={{
                    animation: 'admin-onboarding-fadeInUp 0.4s ease-out both',
                    animationDelay: `${0.1 + i * 0.08}s`,
                  }}
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-stone-900 text-sm">
                      {step.title}
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-6 pb-8 pt-4 flex-shrink-0 border-t border-stone-100">
            <Button onClick={handleDismiss} size="lg" className="w-full">
              Got it, let’s go
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
