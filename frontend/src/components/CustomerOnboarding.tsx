import { useState } from 'react';
import { ListMusic, Search, IndianRupee, Sparkles } from 'lucide-react';
import { Button } from './ui/Button';

const STORAGE_KEY = 'muzobox_customer_onboarding_done';

function getOnboardingSeen(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

function setOnboardingSeen(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, 'true');
}

const steps = [
  {
    icon: ListMusic,
    title: 'Browse playlists',
    description: 'Explore this venue’s collections and find songs you love. Tap a playlist to see what’s available.',
    delay: 0.15,
  },
  {
    icon: Search,
    title: 'Pick a song',
    description: 'Search or browse, then tap a song to see details. Choose it to add your request to the queue.',
    delay: 0.35,
  },
  {
    icon: IndianRupee,
    title: 'Pay to play',
    description: 'Pay via UPI to confirm your request. Your song joins the queue and will play when it’s your turn.',
    delay: 0.55,
  },
];

export default function CustomerOnboarding() {
  const [visible, setVisible] = useState(() => !getOnboardingSeen());

  const handleDismiss = () => {
    setOnboardingSeen();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes onboarding-fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes onboarding-fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes onboarding-scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes onboarding-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes onboarding-glow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-sm"
        style={{
          animation: 'onboarding-fadeIn 0.35s ease-out',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-onboarding-title"
      >
        <div
          className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden"
          style={{
            animation: 'onboarding-scaleIn 0.4s ease-out 0.1s both',
          }}
        >
          {/* Header with gradient and icon */}
          <div className="relative px-6 pt-8 pb-6 bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <div
              className="absolute inset-0 opacity-30"
              style={{ animation: 'onboarding-glow 3s ease-in-out infinite' }}
            />
            <div
              className="relative flex justify-center mb-4"
              style={{ animation: 'onboarding-float 2.5s ease-in-out infinite' }}
            >
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur">
                <Sparkles className="w-8 h-8" />
              </div>
            </div>
            <h2 id="customer-onboarding-title" className="relative text-center font-display text-xl font-bold">
              Welcome to MuzoBox
            </h2>
            <p className="relative text-center text-white/90 text-sm mt-1">Your bar jukebox — here’s how it works</p>
          </div>

          {/* Steps */}
          <div className="px-6 py-6 space-y-5">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={i}
                  className="flex gap-4 items-start"
                  style={{
                    animation: 'onboarding-fadeInUp 0.5s ease-out both',
                    animationDelay: `${step.delay}s`,
                  }}
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-900">{step.title}</h3>
                    <p className="text-sm text-stone-500 mt-0.5 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-6 pb-8 pt-2">
            <Button
              onClick={handleDismiss}
              size="lg"
              className="w-full"
            >
              Get started
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
