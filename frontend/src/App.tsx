import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authService } from './services/auth';

import VenueHome from './pages/customer/VenueHome';
import PlaylistView from './pages/customer/PlaylistView';
import SongDetail from './pages/customer/SongDetail';
import QueueView from './pages/customer/QueueView';

import AdminLogin from './pages/admin/Login';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import DjMode from './pages/admin/DjMode';
import Library from './pages/admin/Library';
import Analytics from './pages/admin/Analytics';
import SuperAdminVenues from './pages/admin/SuperAdminVenues';
import SuperAdminGlobalLibrary from './pages/admin/SuperAdminGlobalLibrary';
import SuperAdminGtm from './pages/admin/SuperAdminGtm';
import Settings from './pages/admin/Settings';
import Landing from './pages/Landing';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000, retry: 1 },
  },
});

function AdminIndexRedirect() {
  const admin = authService.getStoredAdmin();
  const to = admin?.role === 'super_admin' ? '/admin/venues' : '/admin/dashboard';
  return <Navigate to={to} replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Customer routes */}
          <Route path="/:slug" element={<VenueHome />} />
          <Route path="/:slug/playlist/:playlistId" element={<PlaylistView />} />
          <Route path="/:slug/song/:songId" element={<SongDetail />} />
          <Route path="/:slug/queue" element={<QueueView />} />

          {/* Admin routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminIndexRedirect />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="dj" element={<DjMode />} />
            <Route path="library" element={<Library />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
            <Route path="venues" element={<SuperAdminVenues />} />
            <Route path="global-library" element={<SuperAdminGlobalLibrary />} />
            <Route path="gtm" element={<SuperAdminGtm />} />
          </Route>

          <Route path="/" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
