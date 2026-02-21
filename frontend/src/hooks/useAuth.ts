import { useState, useCallback } from 'react';
import { authService } from '../services/auth';
import type { Admin } from '../types';

export function useAuth() {
  const [admin, setAdmin] = useState<Admin | null>(() => authService.getStoredAdmin());

  const login = useCallback(async (email: string, password: string) => {
    const res = await authService.login(email, password);
    setAdmin(res.admin);
    return res;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setAdmin(null);
  }, []);

  return { admin, login, logout, isAuthenticated: !!admin };
}
