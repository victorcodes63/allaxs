"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import { normalizeWebUserRoles } from "@/lib/auth/hub-routing";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  phone?: string | null;
  roles?: string[];
  status?: string;
  /** ISO timestamp when account was auto-provisioned at guest checkout. */
  autoCreatedAt?: string;
  /** Present when the access JWT includes `emailVerified` (password sign-up flow). */
  emailVerified?: boolean;
  hasPassword?: boolean;
  createdAt?: string;
  /** True after organizer onboarding profile is saved (enables fan ↔ host switch). */
  hasOrganizerProfile?: boolean;
}

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  /** Re-fetch the current user from `/api/auth/me` (with the existing refresh fallback). */
  refresh: () => Promise<void>;
  /** Synchronously override the cached user. Useful right after sign-in/out. */
  setUser: (next: AuthUser | null) => void;
}

const AuthContext = createContext<AuthState | null>(null);

const AUTH_BROADCAST_KEY = "allaxs:auth:broadcast";

type AuthBroadcastMessage =
  | { type: "signed-out"; at: number }
  | { type: "signed-in"; at: number };

function writeAuthBroadcast(message: AuthBroadcastMessage) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AUTH_BROADCAST_KEY, JSON.stringify(message));
  } catch {
    // Private mode / quota — ignore; local tab state still updates.
  }
}

async function fetchAuthUser(): Promise<AuthUser | null> {
  const coerce = (raw: unknown): AuthUser | null => {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    const id =
      (typeof o.id === "string" && o.id) ||
      (typeof o.sub === "string" && o.sub) ||
      "";
    const email = typeof o.email === "string" ? o.email : "";
    if (!email && !id) return null;
    return {
      id,
      email,
      name: typeof o.name === "string" ? o.name : undefined,
      phone:
        typeof o.phone === "string"
          ? o.phone
          : o.phone === null
            ? null
            : undefined,
      roles: normalizeWebUserRoles(o.roles),
      status: typeof o.status === "string" ? o.status : undefined,
      autoCreatedAt:
        typeof o.autoCreatedAt === "string" ? o.autoCreatedAt : undefined,
      emailVerified:
        typeof o.emailVerified === "boolean" ? o.emailVerified : undefined,
      hasPassword:
        typeof o.hasPassword === "boolean" ? o.hasPassword : undefined,
      createdAt: typeof o.createdAt === "string" ? o.createdAt : undefined,
      hasOrganizerProfile:
        typeof o.hasOrganizerProfile === "boolean" ? o.hasOrganizerProfile : undefined,
    };
  };

  try {
    const response = await axios.get("/api/auth/me");
    return coerce(response.data?.user);
  } catch (error) {
    if (
      (error as { response?: { status?: number } }).response?.status === 401
    ) {
      try {
        const refreshResponse = await axios.post("/api/auth/refresh");
        return coerce(refreshResponse.data?.user);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Single source of truth for the signed-in user across the app. Wrap the
 * tree (typically just under <body>) so every `useAuth()` consumer reads
 * from the same state instead of each one running its own
 * `/api/auth/me` race. The previous component-local hook caused subtle
 * chrome bugs — most recently the marketing `SiteHeader` rendering on
 * top of the admin shell when AppChrome's local state lagged behind the
 * admin layout's.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef<Promise<void> | null>(null);
  const userRef = useRef<AuthUser | null>(null);
  const skipBroadcastRef = useRef(false);

  userRef.current = user;

  const setUser = useCallback((next: AuthUser | null) => {
    const wasSignedIn = userRef.current !== null;
    setUserState(next);
    if (skipBroadcastRef.current) return;
    if (next === null) {
      writeAuthBroadcast({ type: "signed-out", at: Date.now() });
    } else if (!wasSignedIn) {
      writeAuthBroadcast({ type: "signed-in", at: Date.now() });
    }
  }, []);

  const refresh = useCallback(async () => {
    if (inFlight.current) {
      await inFlight.current;
      return;
    }
    const promise = (async () => {
      try {
        const next = await fetchAuthUser();
        setUser(next);
      } finally {
        setLoading(false);
      }
    })();
    inFlight.current = promise;
    try {
      await promise;
    } finally {
      inFlight.current = null;
    }
  }, [setUser]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_BROADCAST_KEY || !event.newValue) return;
      skipBroadcastRef.current = true;
      try {
        const message = JSON.parse(event.newValue) as AuthBroadcastMessage;
        if (message.type === "signed-out") {
          setUserState(null);
          setLoading(false);
        } else if (message.type === "signed-in") {
          void refresh();
        }
      } catch {
        // Ignore malformed payloads from other tabs.
      } finally {
        skipBroadcastRef.current = false;
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const value = useMemo<AuthState>(
    () => ({ user, loading, refresh, setUser }),
    [user, loading, refresh, setUser],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

/**
 * Read the shared auth state. Must be called from inside <AuthProvider>.
 * For backward compatibility with the prior `lib/auth.ts` API, the
 * returned object still exposes `{ user, loading }` first — anything
 * else (refresh, setUser) is additive.
 */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    if (process.env.NODE_ENV !== "production") {
      // Surfaced in the dev overlay so this never silently regresses
      // back to the per-consumer fetch pattern.
      console.warn(
        "useAuth() was called outside of <AuthProvider>. Wrap the tree in <AuthProvider> in app/layout.tsx.",
      );
    }
    return {
      user: null,
      loading: true,
      refresh: async () => {},
      setUser: () => {},
    };
  }
  return ctx;
}
