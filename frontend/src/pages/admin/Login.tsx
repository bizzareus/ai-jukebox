import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music2, Mail, Lock } from 'lucide-react';
import { authService } from '../../services/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authService.login(email, password);
      navigate(res.admin.role === 'super_admin' ? '/admin/venues' : '/admin/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-50 rounded-2xl mb-4 border border-brand-200">
            <Music2 className="w-7 h-7 text-brand-600" />
          </div>
          <h1 className="font-display text-2xl font-bold text-stone-900">MuzoBox</h1>
          <p className="text-stone-500 text-sm mt-0.5">your bar jukebox</p>
          <p className="text-stone-500 text-sm mt-2">Sign in to manage your venue</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            placeholder="admin@mybar.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail className="w-4 h-4" />}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock className="w-4 h-4" />}
            required
          />
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
          <Button type="submit" size="lg" loading={loading} className="mt-2">
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}
