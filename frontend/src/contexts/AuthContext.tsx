import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, tokenStore } from "../services/api";
import type { AuthResponse, MeResponse } from "../types";

export type AuthStatus = "loading" | "authenticated" | "guest";

interface AuthContextValue {
  status: AuthStatus;
  me: MeResponse | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { full_name: string; email: string; password: string; organization_name: string; invite_token?: string }) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(tokenStore.getAccess() ? "loading" : "guest");
  const [me, setMe] = useState<MeResponse | null>(null);

  const refreshMe = useCallback(async () => {
    const data = await api.get<MeResponse>("/api/auth/me");
    setMe(data);
    setStatus("authenticated");
  }, []);

  // Hydrate session on mount if we have tokens.
  useEffect(() => {
    if (!tokenStore.getAccess()) return;
    refreshMe().catch(() => {
      tokenStore.clear();
      setMe(null);
      setStatus("guest");
    });
  }, [refreshMe]);

  // A failed token refresh anywhere in the app ends the session.
  useEffect(() => {
    const onSessionExpired = () => {
      tokenStore.clear();
      setMe(null);
      setStatus("guest");
    };
    window.addEventListener("nexora:session-expired", onSessionExpired);
    return () => window.removeEventListener("nexora:session-expired", onSessionExpired);
  }, []);

  const applyAuth = useCallback(
    async (auth: AuthResponse) => {
      tokenStore.set(auth);
      await refreshMe();
    },
    [refreshMe]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const auth = await api.post<AuthResponse>("/api/auth/login", { email, password });
      await applyAuth(auth);
    },
    [applyAuth]
  );

  const register = useCallback(
    async (data: { full_name: string; email: string; password: string; organization_name: string; invite_token?: string }) => {
      const auth = await api.post<AuthResponse>("/api/auth/register", data);
      await applyAuth(auth);
    },
    [applyAuth]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // ignore network errors on logout
    }
    tokenStore.clear();
    setMe(null);
    setStatus("guest");
  }, []);

  const hasPermission = useCallback(
    (permission: string) => me?.permissions.includes(permission) ?? false,
    [me]
  );

  const value = useMemo(
    () => ({ status, me, login, register, logout, hasPermission, refreshMe }),
    [status, me, login, register, logout, hasPermission, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
