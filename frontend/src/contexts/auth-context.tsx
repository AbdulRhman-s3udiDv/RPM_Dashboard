import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, configureRefresh, configureSuspended, type ApiUser } from '@/lib/api';

// Refresh the token 5 minutes before it expires
const REFRESH_BUFFER_S = 5 * 60;

type Session = {
  token: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in seconds (Supabase format)
  user: ApiUser;
};

type Ctx = {
  session: Session | null;
  isReady: boolean;
  isSuspended: boolean;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
  clearSuspended: () => void;
  updateUser: (user: ApiUser) => void;
};

const AuthCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = 'rpmcares.session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const sessionRef = useRef<Session | null>(null);

  // Keep the ref in sync so the refresh callback always reads the latest session
  // without causing the callback to be recreated on every render.
  useEffect(() => { sessionRef.current = session; }, [session]);

  const persistSession = useCallback(async (next: Session) => {
    setSession(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const clearSession = useCallback(async () => {
    setSession(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  // Calls POST /api/auth/refresh. On success, persists the new session and
  // returns it. On failure, clears the session (user must log in again).
  const doRefresh = useCallback(async (rt: string): Promise<Session | null> => {
    try {
      const res = await api.refresh(rt);
      const next: Session = {
        token: res.token,
        refreshToken: res.refreshToken,
        expiresAt: res.expiresAt,
        user: res.user,
      };
      await persistSession(next);
      return next;
    } catch {
      await clearSession();
      return null;
    }
  }, [persistSession, clearSession]);

  // Register the 401-retry callback used by api.ts's request() function.
  // We read from sessionRef (not state) so the callback is stable and never
  // accidentally captures a stale refreshToken.
  useEffect(() => {
    configureRefresh(async () => {
      const current = sessionRef.current;
      if (!current?.refreshToken) return null;
      const next = await doRefresh(current.refreshToken);
      return next?.token ?? null;
    });
    return () => configureRefresh(null);
  }, [doRefresh]);

  // Register the suspension callback — fires when any API call returns 403 "suspended".
  useEffect(() => {
    configureSuspended(() => {
      setIsSuspended(true);
      clearSession();
    });
    return () => configureSuspended(null);
  }, [clearSession]);

  // Proactive refresh timer — fires REFRESH_BUFFER_S seconds before expiry.
  // This handles the normal case where the app stays open across the 1-hour
  // Supabase token lifetime.
  useEffect(() => {
    if (!session) return;
    const now = Math.floor(Date.now() / 1000);
    const delay = Math.max(0, (session.expiresAt - now - REFRESH_BUFFER_S) * 1000);
    const timer = setTimeout(() => {
      const current = sessionRef.current;
      if (current?.refreshToken) doRefresh(current.refreshToken);
    }, delay);
    return () => clearTimeout(timer);
  }, [session?.expiresAt, doRefresh]);

  // Hydrate from storage on mount.
  // Validates that the stored session has the fields we need (guards against
  // stale data from the old single-field format).
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(async (raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Partial<Session>;
          if (parsed.token && parsed.refreshToken && parsed.expiresAt && parsed.user) {
            setSession(parsed as Session);
          } else {
            // Old session format — force re-login once
            await AsyncStorage.removeItem(STORAGE_KEY);
          }
        } catch {
          await AsyncStorage.removeItem(STORAGE_KEY);
        }
      }
      setIsReady(true);
    });
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await api.login(email, password);
      const next: Session = {
        token: res.token,
        refreshToken: res.refreshToken,
        expiresAt: res.expiresAt,
        user: res.user,
      };
      await persistSession(next);
      return { ok: true as const };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to sign in.';
      return { ok: false as const, error: message };
    }
  };

  const logout = () => { clearSession(); };

  const clearSuspended = () => { setIsSuspended(false); };

  const updateUser = (user: ApiUser) => {
    setSession((prev) => {
      if (!prev) return null;
      const next = { ...prev, user };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthCtx.Provider value={{ session, isReady, isSuspended, login, logout, clearSuspended, updateUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
