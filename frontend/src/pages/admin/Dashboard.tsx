import { useQuery } from '@tanstack/react-query';
import { IndianRupee, Music2, ListMusic, TrendingUp } from 'lucide-react';
import { api } from '../../services/api';
import { Card } from '../../components/ui/Card';
import { useQueue } from '../../hooks/useQueue';
import { authService } from '../../services/auth';
import { QueueItemStatus } from '../../types';
import type { QueueItem } from '../../types';

interface EarningsData {
  total: number;
  count: number;
  payments: { amount: number; createdAt: string }[];
}

export default function AdminDashboard() {
  const admin = authService.getStoredAdmin();
  const venueId = admin?.venueId;

  const today = new Date().toISOString().split('T')[0];

  const { data: earnings } = useQuery<EarningsData>({
    queryKey: ['earnings', venueId, today],
    queryFn: () => api.get<EarningsData>(`/payments/earnings?startDate=${today}T00:00:00&endDate=${today}T23:59:59`),
    enabled: !!venueId,
  });

  const { data: queue = [] } = useQueue(venueId);

  const nowPlaying = queue.find((i) => i.status === QueueItemStatus.PLAYING);
  const pending = queue.filter((i) => i.status === QueueItemStatus.PENDING);

  const stats = [
    {
      label: "Today's Earnings",
      value: `₹${earnings?.total ?? 0}`,
      icon: IndianRupee,
      color: 'text-green-600',
    },
    {
      label: 'Songs Played',
      value: earnings?.count ?? 0,
      icon: Music2,
      color: 'text-brand-600',
    },
    {
      label: 'In Queue',
      value: pending.length,
      icon: ListMusic,
      color: 'text-blue-600',
    },
  ];

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold text-stone-900">Dashboard</h1>
        <p className="text-stone-500 text-sm mt-0.5">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {stats.map((s) => (
          <Card key={s.label} className="p-3">
            <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
            <p className="text-stone-900 font-bold text-lg">{s.value}</p>
            <p className="text-stone-500 text-xs">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Now playing */}
      {nowPlaying ? (
        <div className="mb-5">
          <h2 className="text-xs font-medium text-brand-600 uppercase tracking-wider mb-2">Now Playing</h2>
          <Card glow className="p-4 flex items-center gap-3">
            {nowPlaying.song.thumbnailUrl && (
              <img src={nowPlaying.song.thumbnailUrl} alt={nowPlaying.song.title} className="w-12 h-12 rounded-lg object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-stone-900 font-semibold truncate">{nowPlaying.song.title}</p>
              {nowPlaying.customerName && (
                <p className="text-brand-600 text-xs">by {nowPlaying.customerName}</p>
              )}
            </div>
            <div className="flex items-end gap-[3px] h-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-1 bg-brand-500 rounded-full animate-bounce" style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </Card>
        </div>
      ) : (
        <Card className="p-4 mb-5 flex items-center gap-3 text-stone-500">
          <Music2 className="w-5 h-5" />
          <span className="text-sm">Nothing playing right now</span>
        </Card>
      )}

      {/* Queue preview */}
      {pending.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-medium text-stone-500 uppercase tracking-wider">Upcoming ({pending.length})</h2>
          </div>
          <div className="flex flex-col gap-1">
            {pending.slice(0, 5).map((item: QueueItem, i) => (
              <div key={item.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-stone-50 transition-colors">
                <span className="text-stone-500 text-xs w-4 text-center">{i + 1}</span>
                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-stone-100">
                  {item.song.thumbnailUrl && (
                    <img src={item.song.thumbnailUrl} alt={item.song.title} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-stone-900 text-xs font-medium truncate">{item.song.title}</p>
                  {item.customerName && <p className="text-stone-500 text-xs">{item.customerName}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!nowPlaying && pending.length === 0 && (
        <div className="text-center py-12 text-stone-500">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No activity yet today</p>
        </div>
      )}
    </div>
  );
}
