"use client";

/**
 * Thin re-export for backward compatibility. The real implementation
 * lives in `./auth-context` which exposes a shared context (mounted at
 * the root in `app/layout.tsx`) so every `useAuth()` consumer reads
 * from the same state instead of running its own `/api/auth/me` race.
 */
export { useAuth, AuthProvider } from "./auth-context";
export type { AuthUser, AuthState } from "./auth-context";
