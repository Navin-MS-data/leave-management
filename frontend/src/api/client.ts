import type { Violation } from './types';

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const TOKEN_KEY = 'passbook.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** Raised when the API answers with an error status. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public violations: Violation[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = tokenStore.get();
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check that the API is running and try again.');
  }

  const text = await response.text();
  const data = text ? safeParse(text) : null;

  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') onUnauthorized?.();
    const raw = data && typeof data === 'object' ? (data as { message?: unknown; violations?: Violation[] }) : {};
    const message = Array.isArray(raw.message) ? raw.message.join('. ') : (raw.message as string | undefined);
    throw new ApiError(response.status, message ?? `Request failed (${response.status})`, raw.violations ?? []);
  }
  return data as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

/** A message that is safe to show to the user for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
