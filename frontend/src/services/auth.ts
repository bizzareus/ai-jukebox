import { api } from './api';
import type { Admin } from '../types';

export interface AuthResponse {
  accessToken: string;
  admin: Admin;
}

export const authService = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>('/auth/login', { email, password });
    localStorage.setItem('jukebox_token', res.accessToken);
    localStorage.setItem('jukebox_admin', JSON.stringify(res.admin));
    return res;
  },

  async me(): Promise<Admin> {
    return api.get<Admin>('/auth/me');
  },

  logout() {
    localStorage.removeItem('jukebox_token');
    localStorage.removeItem('jukebox_admin');
  },

  getStoredAdmin(): Admin | null {
    const raw = localStorage.getItem('jukebox_admin');
    return raw ? (JSON.parse(raw) as Admin) : null;
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('jukebox_token');
  },
};
