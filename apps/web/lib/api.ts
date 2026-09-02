/**
 * Transport layer for talking to the NexusForge API.
 *
 * Design (matches the existing backend contract):
 *  - The short-lived ACCESS token is returned in the JSON body of
 *    login/register/refresh and is held ONLY in memory here (never in
 *    localStorage/sessionStorage). It is attached as `Authorization: Bearer`.
 *  - The long-lived REFRESH token lives in an httpOnly cookie owned by the API
 *    origin. The browser cannot read it; we only ever send it implicitly via
 *    `credentials: 'include'`. We never touch it in JS.
 *  - On a 401 for an authenticated request we attempt a single silent refresh
 *    (single-flight) and retry once. If that fails we surface an unauthorized
 *    signal so the auth state can drop to "unauthenticated".
 */

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  timezone: string;
  language: string;
  theme: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  sessionId: string;
}

export interface SessionInfo {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  revokedAt: string | null;
  current: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

// In-memory access token. Intentionally module-scoped and never persisted.
let accessToken: string | null = null;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;

// Registered by the auth provider so the transport can signal a hard
// authentication failure (refresh exhausted) without importing React.
let onUnauthorized: (() => void) | null = null;
export const setOnUnauthorized = (handler: (() => void) | null) => {
  onUnauthorized = handler;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Turn a backend error payload into a single user-facing message. */
function messageFor(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const message = (body as { message?: unknown }).message;
    if (Array.isArray(message)) return message.filter(Boolean).join(', ');
    if (typeof message === 'string' && message) return message;
  }
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if (status >= 500) return 'Something went wrong on our side. Please try again.';
  return `Request failed (${status}).`;
}

function codeOf(body: unknown): string | undefined {
  if (body && typeof body === 'object') {
    const code = (body as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

// Single-flight refresh: concurrent 401s share one refresh request.
let refreshPromise: Promise<AuthResponse> | null = null;

// A fetch that maps a network-level failure (server down, DNS, CORS block) to a
// clear ApiError instead of a bare TypeError, so callers get a useful message.
async function safeFetch(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and that the API is running.');
  }
}

export function refreshSession(): Promise<AuthResponse> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await safeFetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const body = await parseBody(response);
      if (!response.ok) throw new ApiError(response.status, messageFor(body, response.status), codeOf(body));
      const result = body as AuthResponse;
      setAccessToken(result.accessToken);
      return result;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  /** Whether this call requires the access token (and 401 auto-refresh). */
  auth?: boolean;
  /** Internal: prevents more than one refresh+retry cycle. */
  retry?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, retry = true } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await safeFetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Authenticated request whose access token has expired: refresh once, retry once.
  if (response.status === 401 && auth && retry && path !== '/auth/refresh') {
    try {
      await refreshSession();
    } catch {
      setAccessToken(null);
      onUnauthorized?.();
      throw new ApiError(401, 'Your session has expired. Please sign in again.');
    }
    return apiRequest<T>(path, { ...options, retry: false });
  }

  const parsed = await parseBody(response);
  if (!response.ok) {
    // A 401 on an authenticated request that we could not refresh is a hard failure.
    if (response.status === 401 && auth) onUnauthorized?.();
    throw new ApiError(response.status, messageFor(parsed, response.status), codeOf(parsed));
  }
  return parsed as T;
}
