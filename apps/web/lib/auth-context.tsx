'use client';

/**
 * Client-side authentication state for NexusForge.
 *
 * Status machine: 'loading' (initial silent refresh in flight) -> 'authenticated'
 * or 'unauthenticated'. On mount we attempt a silent refresh using the httpOnly
 * cookie; success hydrates the user + roles, failure lands on 'unauthenticated'.
 * The access token itself lives only in the transport layer's memory (lib/api).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AuthResponse, AuthUser, refreshSession, setAccessToken, setOnUnauthorized } from './api';
import * as auth from './auth';
import type { ProfileUpdate, RegisterInput } from './auth';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  roles: string[];
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  updateProfile: (patch: ProfileUpdate) => Promise<AuthUser>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const mounted = useRef(true);

  const clear = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setRoles([]);
    setStatus('unauthenticated');
  }, []);

  const loadRoles = useCallback(async () => {
    try {
      const keys = await auth.getRoleKeys();
      if (mounted.current) setRoles(keys);
    } catch {
      if (mounted.current) setRoles([]);
    }
  }, []);

  const applySession = useCallback(
    async (result: AuthResponse) => {
      setAccessToken(result.accessToken);
      if (!mounted.current) return;
      setUser(result.user);
      setStatus('authenticated');
      await loadRoles();
    },
    [loadRoles],
  );

  // Register the hard-failure handler and attempt a silent refresh on mount.
  useEffect(() => {
    mounted.current = true;
    setOnUnauthorized(() => {
      if (mounted.current) clear();
    });
    (async () => {
      try {
        const result = await refreshSession();
        await applySession(result);
      } catch {
        if (mounted.current) setStatus('unauthenticated');
      }
    })();
    return () => {
      mounted.current = false;
      setOnUnauthorized(null);
    };
  }, [applySession, clear]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      roles,
      login: async (identifier, password) => {
        const result = await auth.login(identifier, password);
        await applySession(result);
      },
      register: async (input) => {
        const result = await auth.register(input);
        await applySession(result);
      },
      logout: async () => {
        try {
          await auth.logout();
        } finally {
          clear();
        }
      },
      logoutAll: async () => {
        try {
          await auth.logoutAll();
        } finally {
          clear();
        }
      },
      updateProfile: async (patch) => {
        const updated = await auth.updateProfile(patch);
        if (mounted.current) setUser(updated);
        return updated;
      },
      refreshUser: async () => {
        const me = await auth.getMe();
        if (mounted.current) setUser(me);
      },
    }),
    [status, user, roles, applySession, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
