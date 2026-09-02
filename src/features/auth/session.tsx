import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { request } from '@/api/client';
import { ApiError } from '@/api/errors';
import {
  clearSession,
  getTenantSlug,
  setTenantSlug as persistTenantSlug,
  setToken,
} from '@/api/storage';

/**
 * Who is signed in, and to which association.
 *
 * The app has THREE gates at launch, in this order, and the order is not
 * arbitrary:
 *
 *   1. Is an association chosen?   -> association picker
 *   2. Is there a valid session?   -> sign in
 *   3. Which role?                 -> member tabs or staff tabs
 *
 * Tenant before token, because a token issued by one association is
 * meaningless at another - the same reason the API resolves the tenant before
 * authenticating (FR-TEN-1).
 */

export type Role = 'member' | 'superadmin' | 'admin' | 'operator';

export type Profile = {
  id: number;
  name: string;
  mobile?: string | null;
  email?: string | null;
  status?: string;
  membership_no?: string | null;
  shares?: number;
};

export type Session = {
  role: Role;
  /** Server-granted. The app renders from this; it never assumes. */
  permissions: string[];
  profile: Profile;
};

type LoginResult = { token: string } & Session;

type SessionContextValue = {
  /** Still deciding which of the three gates applies. */
  isLoading: boolean;
  tenantSlug: string | null;
  session: Session | null;
  chooseTenant: (slug: string) => Promise<void>;
  signIn: (login: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** True when the signed-in account is association staff, not a member. */
  isStaff: boolean;
  can: (permission: string) => boolean;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [tenantSlug, setTenantSlugState] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const slug = await getTenantSlug();
      if (cancelled) return;

      setTenantSlugState(slug);

      if (!slug) {
        setIsLoading(false);
        return;
      }

      // A stored token may have been revoked from another device. Ask the
      // server rather than trusting its presence.
      try {
        const me = await request<{ data: Session }>('/me');
        if (!cancelled) setSession(me.data);
      } catch (error) {
        // An expired token is an ordinary state, not an error worth surfacing:
        // the member simply sees the sign-in screen.
        if (!(error instanceof ApiError) || !error.requiresReauthentication) {
          // Anything else (offline, suspended association) is left to the
          // screen that renders next, which has the room to explain it.
        }
        if (!cancelled) await clearSession();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const chooseTenant = useCallback(async (slug: string) => {
    await persistTenantSlug(slug);
    setTenantSlugState(slug);
  }, []);

  const signIn = useCallback(async (login: string, password: string) => {
    const response = await request<{ data: LoginResult }>('/auth/login', {
      method: 'POST',
      body: { login, password, device_name: 'mobile' },
    });

    const { token, ...rest } = response.data;

    await setToken(token);
    setSession(rest);
  }, []);

  const signOut = useCallback(async () => {
    // Best effort: revoke server-side, but a member who taps Sign out must end
    // up signed out locally even with no connection.
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch {
      // Ignored deliberately.
    }

    await clearSession();
    setSession(null);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      isLoading,
      tenantSlug,
      session,
      chooseTenant,
      signIn,
      signOut,
      isStaff: session !== null && session.role !== 'member',

      /**
       * Permission checks come from the SERVER's list, never from a role name
       * hard-coded here. An association can grant its operator extra
       * permissions, and the app must follow that without a release
       * (FR-APP-1).
       */
      can: (permission: string) => session?.permissions.includes(permission) ?? false,
    }),
    [isLoading, tenantSlug, session, chooseTenant, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used inside a SessionProvider.');
  }

  return context;
}
