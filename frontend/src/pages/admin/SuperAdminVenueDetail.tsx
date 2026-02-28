import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  UserPlus,
  Pencil,
  IndianRupee,
  Music2,
  Calendar,
  Users,
  Key,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { authService } from '../../services/auth';
import type { Venue } from '../../types';

interface VenueAdmin {
  id: string;
  email: string;
  name: string;
  role: string;
  venueId: string | null;
  createdAt: string;
}

interface PaymentRow {
  id: string;
  amount: number;
  createdAt: string;
  songId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
}

interface EarningsData {
  total: number;
  count: number;
  payments: PaymentRow[];
}

interface RecentCustomer {
  customerName: string | null;
  customerMobile: string | null;
  lastSeen: string;
}

export default function SuperAdminVenueDetail() {
  const { venueId } = useParams<{ venueId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const admin = authService.getStoredAdmin();

  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editUpiVpa, setEditUpiVpa] = useState('');
  const [editPricePerSong, setEditPricePerSong] = useState(100);
  const [editDiscountAmount, setEditDiscountAmount] = useState(0);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const [addAdminEmail, setAddAdminEmail] = useState('');
  const [addAdminPassword, setAddAdminPassword] = useState('');
  const [addAdminName, setAddAdminName] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [addAdminError, setAddAdminError] = useState('');

  const [resetPwAdminId, setResetPwAdminId] = useState<string | null>(null);
  const [resetPwPassword, setResetPwPassword] = useState('');
  const [resetPwConfirm, setResetPwConfirm] = useState('');
  const [resettingPw, setResettingPw] = useState(false);
  const [resetPwError, setResetPwError] = useState('');

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: venue, isLoading: venueLoading } = useQuery<Venue>({
    queryKey: ['venue', venueId],
    queryFn: () => api.get<Venue>(`/venues/by-id/${venueId}`),
    enabled: !!venueId && !!admin?.id,
  });

  const { data: admins = [], isLoading: adminsLoading } = useQuery<VenueAdmin[]>({
    queryKey: ['venue-admins', venueId],
    queryFn: () => api.get<VenueAdmin[]>(`/venues/${venueId}/admins`),
    enabled: !!venueId && !!admin?.id,
  });

  const { data: earnings } = useQuery<EarningsData>({
    queryKey: ['earnings', venueId, selectedDate],
    queryFn: () =>
      api.get<EarningsData>(
        `/payments/earnings?venueId=${venueId}&startDate=${selectedDate}T00:00:00&endDate=${selectedDate}T23:59:59`,
      ),
    enabled: !!venueId && !!admin?.id,
  });

  const { data: recentCustomers = [] } = useQuery<RecentCustomer[]>({
    queryKey: ['recent-customers', venueId],
    queryFn: () => api.get<RecentCustomer[]>(`/venues/${venueId}/recent-customers?limit=50`),
    enabled: !!venueId && !!admin?.id,
  });

  useEffect(() => {
    if (venue) {
      setEditName(venue.name);
      setEditSlug(venue.slug);
      setEditUpiVpa(venue.upiVpa);
      setEditPricePerSong(venue.pricePerSong);
      setEditDiscountAmount(venue.discountAmount ?? 0);
    }
  }, [venue?.id]);

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venueId) return;
    setEditError('');
    setSavingEdit(true);
    try {
      await api.patch(`/venues/${venueId}`, {
        name: editName.trim(),
        slug: editSlug.trim(),
        upiVpa: editUpiVpa.trim(),
        pricePerSong: editPricePerSong,
        discountAmount: editDiscountAmount,
      });
      queryClient.invalidateQueries({ queryKey: ['venue', venueId] });
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Failed to update venue');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venueId) return;
    setAddAdminError('');
    setAddingAdmin(true);
    try {
      await api.post(`/venues/${venueId}/admins`, {
        email: addAdminEmail.trim(),
        password: addAdminPassword,
        name: addAdminName.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['venue-admins', venueId] });
      setAddAdminEmail('');
      setAddAdminPassword('');
      setAddAdminName('');
    } catch (err: unknown) {
      setAddAdminError(err instanceof Error ? err.message : 'Failed to add admin');
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwAdminId || resetPwPassword !== resetPwConfirm) {
      setResetPwError('Passwords do not match');
      return;
    }
    if (resetPwPassword.length < 8) {
      setResetPwError('Password must be at least 8 characters');
      return;
    }
    setResetPwError('');
    setResettingPw(true);
    try {
      await api.patch(`/admins/${resetPwAdminId}/password`, { newPassword: resetPwPassword });
      setResetPwAdminId(null);
      setResetPwPassword('');
      setResetPwConfirm('');
    } catch (err: unknown) {
      setResetPwError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setResettingPw(false);
    }
  };

  const handleRemoveAdmin = async (adminId: string) => {
    if (!window.confirm('Remove this admin? They will no longer be able to log in.')) return;
    try {
      await api.delete(`/admins/${adminId}`);
      queryClient.invalidateQueries({ queryKey: ['venue-admins', venueId] });
    } catch (err: unknown) {
      console.log(err instanceof Error ? err.message : 'Failed to remove admin');
    }
  };

  const frontendUrl = typeof window !== 'undefined' ? window.location.origin : '';

  if (venueLoading || !venue) {
    return (
      <div className="px-4 pt-6 pb-4">
        <p className="text-stone-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="flex items-center gap-3 mb-5">
        <button
          type="button"
          onClick={() => navigate('/admin/venues')}
          className="p-2 rounded-lg hover:bg-stone-100 text-stone-600"
          aria-label="Back to venues"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl font-bold text-stone-900 truncate">{venue.name}</h1>
          <p className="text-stone-500 text-sm">{venue.slug} · ₹{venue.pricePerSong}/song</p>
        </div>
        <a
          href={`${frontendUrl}/${venue.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-stone-500 hover:text-brand-600 p-2"
          title="Open customer view"
        >
          <ExternalLink className="w-5 h-5" />
        </a>
      </div>

      {/* Details */}
      <Card className="p-4 mb-5">
        <h2 className="font-semibold text-stone-900 mb-3 flex items-center gap-2">
          <Pencil className="w-4 h-4" />
          Details
        </h2>
        <form onSubmit={handleSaveDetails} className="flex flex-col gap-3">
          <Input label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="My Bar" required />
          <Input label="Slug (URL)" value={editSlug} onChange={(e) => setEditSlug(e.target.value)} placeholder="my-bar" required />
          <Input label="UPI VPA" value={editUpiVpa} onChange={(e) => setEditUpiVpa(e.target.value)} placeholder="bar@okaxis" required />
          <Input label="Price per song (₹)" type="number" value={String(editPricePerSong)} onChange={(e) => setEditPricePerSong(Number(e.target.value) || 100)} />
          <Input label="Discount amount (₹)" type="number" value={String(editDiscountAmount)} onChange={(e) => setEditDiscountAmount(Math.max(0, Number(e.target.value) || 0))} />
          {editError && <p className="text-red-600 text-sm">{editError}</p>}
          <Button type="submit" loading={savingEdit}>Save changes</Button>
        </form>
      </Card>

      {/* Admins */}
      <Card className="p-4 mb-5">
        <h2 className="font-semibold text-stone-900 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Admins
        </h2>
        {adminsLoading ? (
          <p className="text-stone-500 text-sm">Loading…</p>
        ) : (
          <>
            {admins.length === 0 ? (
              <p className="text-stone-500 text-sm mb-3">No admins yet.</p>
            ) : (
              <ul className="mb-4 space-y-2">
                {admins.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-2 border-b border-stone-100 last:border-0">
                    <div>
                      <p className="font-medium text-stone-900">{a.name}</p>
                      <p className="text-stone-500 text-sm">{a.email}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => { setResetPwAdminId(a.id); setResetPwPassword(''); setResetPwConfirm(''); setResetPwError(''); }}
                        title="Reset password"
                      >
                        <Key className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveAdmin(a.id)}
                        title="Remove admin"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <h3 className="text-sm font-medium text-stone-700 mb-2">Add admin</h3>
            <form onSubmit={handleAddAdmin} className="flex flex-col gap-3">
              <Input label="Email" type="email" value={addAdminEmail} onChange={(e) => setAddAdminEmail(e.target.value)} placeholder="admin@bar.com" required />
              <Input label="Password" type="password" value={addAdminPassword} onChange={(e) => setAddAdminPassword(e.target.value)} placeholder="Min 8 characters" required />
              <Input label="Name (optional)" value={addAdminName} onChange={(e) => setAddAdminName(e.target.value)} placeholder="Bar Manager" />
              {addAdminError && <p className="text-red-600 text-sm">{addAdminError}</p>}
              <Button type="submit" loading={addingAdmin}>Add admin</Button>
            </form>
          </>
        )}
      </Card>

      {/* Reset password modal */}
      {resetPwAdminId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="p-4 w-full max-w-sm">
            <h3 className="font-semibold text-stone-900 mb-3">Reset password</h3>
            <form onSubmit={handleResetPassword} className="flex flex-col gap-3">
              <Input label="New password" type="password" value={resetPwPassword} onChange={(e) => setResetPwPassword(e.target.value)} placeholder="Min 8 characters" required />
              <Input label="Confirm password" type="password" value={resetPwConfirm} onChange={(e) => setResetPwConfirm(e.target.value)} placeholder="Confirm" required />
              {resetPwError && <p className="text-red-600 text-sm">{resetPwError}</p>}
              <div className="flex gap-2">
                <Button type="submit" loading={resettingPw}>Reset</Button>
                <Button type="button" variant="outline" onClick={() => { setResetPwAdminId(null); setResetPwError(''); }}>Cancel</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Activity */}
      <Card className="p-4 mb-5">
        <h2 className="font-semibold text-stone-900 mb-3 flex items-center gap-2">
          <IndianRupee className="w-4 h-4" />
          Activity
        </h2>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-brand-600" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-white border border-surface-border rounded-xl px-3 py-2 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            aria-label="Select date"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-stone-50 rounded-xl p-3">
            <p className="text-stone-900 font-bold text-xl">₹{earnings?.total ?? 0}</p>
            <p className="text-stone-500 text-xs">Earnings</p>
          </div>
          <div className="bg-stone-50 rounded-xl p-3">
            <p className="text-stone-900 font-bold text-xl">{earnings?.count ?? 0}</p>
            <p className="text-stone-500 text-xs">Songs paid</p>
          </div>
        </div>
        <h3 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">Recent customers</h3>
        {recentCustomers.length === 0 ? (
          <p className="text-stone-500 text-sm">No recent customers</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-surface-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-surface-border text-left text-stone-500 uppercase tracking-wider text-xs">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Mobile</th>
                  <th className="px-4 py-3 font-medium">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {recentCustomers.map((c, i) => (
                  <tr key={i} className="border-b border-surface-border last:border-0">
                    <td className="px-4 py-3 text-stone-900">{c.customerName ?? '—'}</td>
                    <td className="px-4 py-3 text-stone-900">{c.customerMobile ?? '—'}</td>
                    <td className="px-4 py-3 text-stone-600">{new Date(c.lastSeen).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
