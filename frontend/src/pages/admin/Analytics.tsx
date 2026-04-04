import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IndianRupee, Music2, Calendar, Filter } from "lucide-react";
import { api } from "../../services/api";
import { Card } from "../../components/ui/Card";
import { authService } from "../../services/auth";
import { QueueItemStatus } from "../../types";
import type { QueueItem } from "../../types";
import type { Venue } from "../../types";

type PaymentStatusFilter = "all" | "paid" | "failed" | "created";

interface PaymentRow {
  id: string;
  amount: number;
  createdAt: string;
  songId: string;
  songTitle: string | null;
  qrid: string | null;
  customerName: string | null;
  customerMobile: string | null;
  status: "paid" | "failed" | "created";
  razorpayPaymentId: string | null;
}

interface EarningsData {
  total: number;
  count: number;
  payments: PaymentRow[];
}

type DailyPlayRow = { date: string; count: number };

export default function Analytics() {
  const admin = authService.getStoredAdmin();
  const venueId = admin?.venueId;

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>("all");

  const { data: venue, isLoading: venueLoading } = useQuery<Venue>({
    queryKey: ["venue", "current"],
    queryFn: () => api.get<Venue>("/venues/current"),
    enabled: !!venueId,
  });

  const pricingOn = venue?.pricingEnabled !== false;

  const { data: earnings } = useQuery<EarningsData>({
    queryKey: ["earnings", venueId, selectedDate],
    queryFn: () =>
      api.get<EarningsData>(
        `/payments/earnings?startDate=${selectedDate}T00:00:00&endDate=${selectedDate}T23:59:59`,
      ),
    enabled: !!venueId && !!venue && pricingOn,
  });

  const { data: dailyStats = [], isLoading: dailyStatsLoading } = useQuery<
    DailyPlayRow[]
  >({
    queryKey: ["queue", "daily-stats", venueId, 30],
    queryFn: () =>
      api.get<DailyPlayRow[]>(
        `/queue/${venueId}/history/daily-stats?days=30`,
      ),
    enabled: !!venueId && !!venue && !pricingOn,
  });

  const { data: historyRaw = [], isLoading: historyLoading } = useQuery<
    QueueItem[]
  >({
    queryKey: ["queue", "history", venueId, selectedDate, "plays"],
    queryFn: () =>
      api.get<QueueItem[]>(
        `/queue/${venueId}/history?date=${selectedDate}&limit=200`,
      ),
    enabled: !!venueId && !!venue && !pricingOn,
  });

  const playHistory = useMemo(
    () =>
      historyRaw.filter((item) => item.status === QueueItemStatus.PLAYED),
    [historyRaw],
  );

  const maxDaily = useMemo(
    () => Math.max(1, ...dailyStats.map((d) => d.count)),
    [dailyStats],
  );

  const filteredPayments =
    earnings?.payments == null
      ? []
      : statusFilter === "all"
        ? earnings.payments
        : earnings.payments.filter((p) => p.status === statusFilter);

  if (!venueId) {
    return (
      <div className="px-4 pt-6 pb-4">
        <p className="text-stone-500 text-sm">No venue assigned.</p>
      </div>
    );
  }

  if (venueLoading || !venue) {
    return (
      <div className="px-4 pt-6 pb-4 flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!pricingOn) {
    return (
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-5">
          <h1 className="font-display text-2xl font-bold text-stone-900">
            Analytics
          </h1>
        </div>

        <div className="mb-5">
          <h2 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">
            Plays per day (last 30 days)
          </h2>
          {dailyStatsLoading ? (
            <p className="text-stone-500 text-sm">Loading…</p>
          ) : dailyStats.length === 0 ? (
            <p className="text-stone-500 text-sm">No play data yet.</p>
          ) : (
            <Card className="p-4 flex flex-col gap-2">
              {dailyStats.map((row) => (
                <div
                  key={row.date}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="text-stone-500 w-[88px] shrink-0 tabular-nums">
                    {new Date(row.date + "T12:00:00Z").toLocaleDateString(
                      "en-IN",
                      { day: "numeric", month: "short" },
                    )}
                  </span>
                  <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden min-w-0">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all"
                      style={{
                        width: `${Math.round((row.count / maxDaily) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-stone-900 font-medium w-8 text-right tabular-nums">
                    {row.count}
                  </span>
                </div>
              ))}
            </Card>
          )}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-brand-600" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-white border border-surface-border rounded-xl px-3 py-2 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            aria-label="Select date for play history"
          />
        </div>

        <h2 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">
          Songs played
        </h2>
        {historyLoading ? (
          <p className="text-stone-500 text-sm">Loading…</p>
        ) : playHistory.length === 0 ? (
          <p className="text-stone-500 text-sm">No completed plays on this day.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-surface-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-surface-border text-left text-stone-500 uppercase tracking-wider text-xs">
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Song</th>
                  <th className="px-4 py-3 font-medium">Requested by</th>
                </tr>
              </thead>
              <tbody>
                {playHistory.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-surface-border last:border-0"
                  >
                    <td className="px-4 py-3 text-stone-900 whitespace-nowrap">
                      {item.playedAt
                        ? new Date(item.playedAt).toLocaleString("en-IN", {
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td
                      className="px-4 py-3 text-stone-900 max-w-[200px] truncate"
                      title={item.song?.title}
                    >
                      {item.song?.title ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-stone-900">
                      {item.customerName?.trim() || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-bold text-stone-900">
          Analytics
        </h1>
      </div>

      {/* Date picker */}
      <div className="flex items-center gap-2 mb-5">
        <Calendar className="w-4 h-4 text-brand-600" />
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-white border border-surface-border rounded-xl px-3 py-2 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          aria-label="Select date"
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <Card className="p-4">
          <IndianRupee className="w-5 h-5 text-green-600 mb-2" />
          <p className="text-stone-900 font-bold text-2xl">
            ₹{earnings?.total ?? 0}
          </p>
          <p className="text-stone-500 text-xs">Total earnings</p>
        </Card>
        <Card className="p-4">
          <Music2 className="w-5 h-5 text-brand-600 mb-2" />
          <p className="text-stone-900 font-bold text-2xl">
            {earnings?.count ?? 0}
          </p>
          <p className="text-stone-500 text-xs">Songs paid</p>
        </Card>
      </div>

      {/* Payments table */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-xs font-medium text-stone-500 uppercase tracking-wider">
          Payments
        </h2>
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-stone-400" />
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as PaymentStatusFilter)
            }
            className="bg-white border border-surface-border rounded-lg px-2.5 py-1.5 text-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            aria-label="Filter table by status"
          >
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="created">Unpaid</option>
          </select>
        </div>
      </div>
      {!earnings?.payments?.length ? (
        <p className="text-stone-500 text-sm mb-5">
          No payments in this period
        </p>
      ) : !filteredPayments.length ? (
        <p className="text-stone-500 text-sm mb-5">
          No {statusFilter === "created" ? "unpaid" : statusFilter} payments in
          this period
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-border mb-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-surface-border text-left text-stone-500 uppercase tracking-wider text-xs">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Song</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">QR ID</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Mobile</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-surface-border last:border-0"
                >
                  <td className="px-4 py-3 text-stone-900">
                    {new Date(p.createdAt).toLocaleString("en-IN", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td
                    className="px-4 py-3 text-stone-900 max-w-[180px] truncate"
                    title={p.songTitle ?? undefined}
                  >
                    {p.songTitle ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-stone-900">₹{p.amount}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        p.status === "paid"
                          ? "bg-green-100 text-green-800"
                          : p.status === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {p.status === "created" ? "Unpaid" : p.status}
                    </span>
                  </td>
                  <td
                    className="px-4 py-3 font-mono text-stone-600 text-xs max-w-[120px] truncate"
                    title={p.qrid ?? undefined}
                  >
                    {p.qrid ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-stone-900">
                    {p.customerName ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-stone-900">
                    {p.customerMobile ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
