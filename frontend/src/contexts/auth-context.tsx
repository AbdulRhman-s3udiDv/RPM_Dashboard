import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, type ApiUser } from '@/lib/api';

type Session = { token: string; user: ApiUser };

type Ctx = {
  session: Session | null;
  isReady: boolean;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
  updateUser: (user: ApiUser) => void;
};

const AuthCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = 'rpmcares.session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          setSession(JSON.parse(raw) as Session);
        } catch {
          AsyncStorage.removeItem(STORAGE_KEY);
        }
      }
      setIsReady(true);
    });
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await api.login(email, password);
      const next: Session = { token: res.token, user: res.user };
      setSession(next);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return { ok: true as const };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to sign in.';
      return { ok: false as const, error: message };
    }
  };

  const logout = () => {
    setSession(null);
    AsyncStorage.removeItem(STORAGE_KEY);
  };

  const updateUser = (user: ApiUser) => {
    setSession((prev) => {
      if (!prev) return null;
      const next = { ...prev, user };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return <AuthCtx.Provider value={{ session, isReady, login, logout, updateUser }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
