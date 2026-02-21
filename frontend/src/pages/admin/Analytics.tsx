import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { IndianRupee, Music2, Calendar } from 'lucide-react';
import { api } from '../../services/api';
import { Card } from '../../components/ui/Card';
import { authService } from '../../services/auth';
import type { QueueItem } from '../../types';

interface EarningsData {
  total: number;
  count: number;
  payments: { id: string; amount: number; createdAt: string; songId: string }[];
}

export default function Analytics() {
  const admin = authService.getStoredAdmin();
  const venueId = admin?.venueId;

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: earnings } = useQuery<EarningsData>({
    queryKey: ['earnings', venueId, selectedDate],
    queryFn: () =>
      api.get<EarningsData>(
        `/payments/earnings?startDate=${selectedDate}T00:00:00&endDate=${selectedDate}T23:59:59`,
      ),
    enabled: !!venueId,
  });

  const { data: history = [] } = useQuery<QueueItem[]>({
    queryKey: ['history', venueId, selectedDate],
    queryFn: () => api.get<QueueItem[]>(`/queue/${venueId}/history?date=${selectedDate}`),
    enabled: !!venueId,
  });

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-bold text-stone-900">Analytics</h1>
      </div>

      {/* Date picker */}
      <div className="flex items-center gap-2 mb-5">
        <Calendar className="w-4 h-4 text-brand-600" />
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-white border border-surface-border rounded-xl px-3 py-2 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <Card className="p-4">
          <IndianRupee className="w-5 h-5 text-green-600 mb-2" />
          <p className="text-stone-900 font-bold text-2xl">₹{earnings?.total ?? 0}</p>
          <p className="text-stone-500 text-xs">Total earnings</p>
        </Card>
        <Card className="p-4">
          <Music2 className="w-5 h-5 text-brand-600 mb-2" />
          <p className="text-stone-900 font-bold text-2xl">{earnings?.count ?? 0}</p>
          <p className="text-stone-500 text-xs">Songs paid</p>
        </Card>
      </div>

      {/* Song history */}
      <h2 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">Song History</h2>
      {history.length === 0 ? (
        <div className="text-center py-12 text-stone-500">
          <Music2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No songs played on this day</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {history.map((item) => (
            <Card key={item.id} className="flex items-center gap-3 p-3">
              {item.song.thumbnailUrl ? (
                <img src={item.song.thumbnailUrl} alt={item.song.title} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
              ) : (
<div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                  <Music2 className="w-4 h-4 text-stone-400" />
                </div>
              )}
                <div className="flex-1 min-w-0">
                <p className="text-stone-900 text-sm font-medium truncate">{item.song.title}</p>
                <p className="text-stone-500 text-xs">
                  {item.customerName && `${item.customerName} · `}
                  {item.playedAt ? new Date(item.playedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 text-green-400 flex-shrink-0">
                <IndianRupee className="w-3 h-3" />
                <span className="text-sm font-semibold">100</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
