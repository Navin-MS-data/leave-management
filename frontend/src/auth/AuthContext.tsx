import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from '../api/client';
import type { AuthUser, LoginResponse, Role } from '../api/types';

interface AuthState {
  user: AuthUser | null;
  /** True while a stored token is being checked on first load. */
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(() => tokenStore.get() !== null);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    if (!tokenStore.get()) return;
    let cancelled = false;
    api
      .get<AuthUser>('/auth/me')
      .then((me) => !cancelled && setUser(me))
      .catch(() => !cancelled && tokenStore.clear())
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await api.post<LoginResponse>('/auth/login', { email, password });
      tokenStore.set(result.accessToken);
      queryClient.clear();
      setUser(result.user);
      return result.user;
    },
    [queryClient],
  );

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Roles that can request leave and hold a balance. Admins do neither. */
export const canRequestLeave = (role: Role) => role === 'employee' || role === 'manager';
export const canDecide = (role: Role) => role === 'manager' || role === 'admin';

export function homePath(role: Role): string {
  return role === 'admin' ? '/approvals' : '/';
}
