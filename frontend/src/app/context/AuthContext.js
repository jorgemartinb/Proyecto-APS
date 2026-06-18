"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";
const STORAGE_KEY = "aps_reservas_auth";

function getStoredAuth() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveStoredAuth(auth) {
  if (typeof window === "undefined") return;
  if (auth) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null);

  const updateAuth = useCallback((nextAuth) => {
    setAuth(nextAuth);
    saveStoredAuth(nextAuth);
  }, []);

  const loadProfile = useCallback(async (session) => {
    const profileResponse = await fetch(`${API_BASE}/user/profile/`, {
      headers: { Authorization: `Bearer ${session.access}` },
    });
    if (!profileResponse.ok) throw new Error("No se pudo cargar el perfil");
    const profile = await profileResponse.json();
    return { ...session, profile };
  }, []);

  const request = useCallback(
    async (path, options = {}, retry = true) => {
      const send = (accessToken) => {
        const headers = new Headers(options.headers || {});
        if (!(options.body instanceof FormData)) {
          headers.set("Content-Type", "application/json");
        }
        if (accessToken) {
          headers.set("Authorization", `Bearer ${accessToken}`);
        }
        return fetch(`${API_BASE}${path}`, { ...options, headers });
      };

      let response = await send(auth?.access);

      if (response.status === 401 && retry && auth?.refresh) {
        const refreshResponse = await fetch(`${API_BASE}/auth/token/refresh/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: auth.refresh }),
        });

        if (refreshResponse.ok) {
          const tokenData = await refreshResponse.json();
          const refreshedAuth = { ...auth, access: tokenData.access };
          updateAuth(refreshedAuth);
          response = await send(tokenData.access);
        } else {
          updateAuth(null);
        }
      }

      if (!response.ok) {
        let payload = null;
        try {
          payload = await response.json();
        } catch {
          payload = { detail: response.statusText };
        }
        throw payload;
      }

      if (response.status === 204 || response.status === 205) return null;
      return response.json();
    },
    [auth, updateAuth],
  );

  useEffect(() => {
    const stored = getStoredAuth();
    if (!stored?.access) return;
    loadProfile(stored)
      .then(updateAuth)
      .catch(() => updateAuth(null));
  }, [loadProfile, updateAuth]);

  const isAdmin = auth?.profile?.is_staff || false;
  const currentUser = auth?.profile?.username;
  const socioActivo = auth?.profile?.es_socio && auth?.profile?.estado_socio === "ACEPTADA";
  const canRequestCompras = Boolean(auth && (isAdmin || socioActivo));

  return (
    <AuthContext.Provider
      value={{ auth, updateAuth, request, loadProfile, isAdmin, currentUser, socioActivo, canRequestCompras }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

export { API_BASE };
