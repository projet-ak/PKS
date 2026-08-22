import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, setToken, type UserInfo } from "./api";

interface AuthState {
  user: UserInfo | null;
  /// Token dogrulanana kadar true; bu sirada giris ekranini gostermeyiz,
  /// aksi halde her yenilemede giris formu bir an parlar.
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_TOKEN = "pts.token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_TOKEN);
    if (!saved) {
      setLoading(false);
      return;
    }

    setToken(saved);
    // Token suresi dolmus olabilir; sunucuya sorup emin oluyoruz.
    api
      .me()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem(STORAGE_TOKEN);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password);
    localStorage.setItem(STORAGE_TOKEN, res.token);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_TOKEN);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth, AuthProvider icinde kullanilmali");
  return ctx;
}
