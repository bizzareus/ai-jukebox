import { Link } from 'react-router-dom';
import { Music2, IndianRupee, Users, Sparkles, LogIn } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-surface">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/10 via-surface to-brand-900/5" />
        <div className="relative px-4 pt-16 pb-20 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-500 text-white shadow-lg mb-6">
            <Music2 className="w-7 h-7" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight">
            MuzoBox
          </h1>
          <p className="text-brand-600 font-medium mt-1">your bar jukebox</p>
          <p className="mt-4 text-lg text-stone-600">
            Let customers pick the music, pay to queue songs, and keep the vibe going. Earn revenue and engage your crowd with MuzoBox.
          </p>
        </div>
      </div>

      {/* Value props */}
      <div className="px-4 pb-16 max-w-xl mx-auto">
        <div className="grid gap-4">
          <div className="flex gap-4 p-4 rounded-2xl bg-white border border-surface-border shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
              <IndianRupee className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h2 className="font-semibold text-stone-900">Earn revenue</h2>
              <p className="text-sm text-stone-500 mt-0.5">
                Set your price per song. Customers pay via UPI to add tracks to the queue—simple and direct.
              </p>
            </div>
          </div>
          <div className="flex gap-4 p-4 rounded-2xl bg-white border border-surface-border shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h2 className="font-semibold text-stone-900">Engage customers</h2>
              <p className="text-sm text-stone-500 mt-0.5">
                Patrons choose what plays next. Less dead air, more requests, and a livelier atmosphere.
              </p>
            </div>
          </div>
          <div className="flex gap-4 p-4 rounded-2xl bg-white border border-surface-border shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h2 className="font-semibold text-stone-900">Run it your way</h2>
              <p className="text-sm text-stone-500 mt-0.5">
                Build playlists, control the queue from DJ mode, offer discounts, and see what’s popular.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-stone-500 text-sm mb-3">Bar or venue owner?</p>
          <Link
            to="/admin/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold shadow-md hover:bg-brand-700 active:scale-[0.98] transition-all"
          >
            <LogIn className="w-5 h-5" />
            Venue admin
          </Link>
        </div>
      </div>
    </div>
  );
}
