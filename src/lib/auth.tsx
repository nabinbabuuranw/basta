import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type User, type SchoolRef } from './api';
interface AuthState { user: User | null; school: SchoolRef | null; loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void> }
const Ctx = createContext<AuthState>(null as any);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [s, set] = useState<{ user: User | null; school: SchoolRef | null; loading: boolean }>({ user: null, school: null, loading: true });
  const refresh = useCallback(async () => {
    try { const r = await api('/me'); set({ user: r.user, school: r.school || null, loading: false }); } catch { set({ user: null, school: null, loading: false }); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const logout = useCallback(async () => { try { await api('/auth/logout', { method: 'POST' }); } finally { set({ user: null, school: null, loading: false }); } }, []);
  return <Ctx.Provider value={{ ...s, refresh, logout }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
export const homeFor = (role?: string) => (role === 'staff' ? '/app' : role === 'admin' ? '/admin' : '/family');
