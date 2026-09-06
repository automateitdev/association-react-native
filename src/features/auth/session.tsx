import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { request } from '@/api/client';
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
  /**
   * The fields a member may ask to have changed (FR-MEM-8), as currently on
   * file. Keyed by the server's own ALLOWED list so the change form can show
   * what is held before somebody asks to change it.
   */
  editable?: Record<string, string | null>;
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
  signIn: (login: string, password: string, as?: 'staff' | 'member') => Promise<void>;
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

  // Used on sign-out to drop another member's cached money. See signOut below.
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      /*
       * EVERYTHING here is inside one try/finally, deliberately.
       *
       * An earlier version awaited storage OUTSIDE the try. When
       * expo-secure-store threw - which it does on web, where it has no
       * implementation at all - the rejection escaped, `setIsLoading(false)`
       * never ran, and the app sat on a spinner forever with no error and no
       * way forward.
       *
       * That is not a web-only concern: a Keychain read can fail on a device
       * too. Whatever happens, this must end with isLoading false, because a
       * screen that explains itself beats a spinner that does not.
       */
      try {
        const slug = await getTenantSlug();
        if (cancelled) return;

        setTenantSlugState(slug);

        // No association yet: nothing to validate, and the picker is next.
        if (!slug) return;

        // A stored token may have been revoked from another device. Ask the
        // server rather than trusting its presence.
        const me = await request<{ data: Session }>('/me');
        if (!cancelled) setSession(me.data);
      } catch (error) {
        // An expired token is an ordinary state, not an error worth surfacing:
        // the member simply lands on the sign-in screen. Anything else -
        // offline, suspended association, unreadable storage - is left to the
        // screen that renders next, which has room to explain it.
        if (!cancelled) {
          try {
            await clearSession();
          } catch {
            // Storage is already misbehaving; there is nothing further to do.
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const chooseTenant = useCallback(
    async (slug: string) => {
      await persistTenantSlug(slug);
      setTenantSlugState(slug);

      // Same leak as sign-out, across a harder boundary: cached data belonging
      // to one association must never survive into another. Every request is
      // scoped by X-Tenant, but the cache is keyed by path alone, so switching
      // association without clearing would serve the previous association's
      // figures under the new one's name.
      queryClient.clear();
    },
    [queryClient],
  );

  /**
   * `as` names which account, when one person holds both (SRS OD-4).
   *
   * Sent only on a SECOND attempt, after the first came back
   * ACCOUNT_AMBIGUOUS. It names which account to try; it does not vouch for
   * anything - the password is still checked against that account alone.
   */
  const signIn = useCallback(async (login: string, password: string, as?: 'staff' | 'member') => {
    const response = await request<{ data: LoginResult }>('/auth/login', {
      method: 'POST',
      body: { login, password, device_name: 'mobile', ...(as ? { as } : {}) },
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

    /*
     * Dropping local state must happen even if clearing storage fails.
     *
     * A member who taps Sign out has to end up signed out. If the storage write
     * throws and we bail here, they stay signed in holding a token the server
     * has already revoked - and, worse, holding a warm cache of their own data
     * for whoever signs in next. The finally block is what makes the guarantee
     * below unconditional.
     */
    try {
      await clearSession();
    } finally {
      setSession(null);

      /*
       * Clearing the token is NOT enough. The query cache outlives it.
       *
       * Without this, signing out and signing in as someone else on the same
       * device serves the PREVIOUS member's cached dues, lifetime totals and
       * share count to the new one. The header updates - /me is refetched - so
       * the screen shows the right name above the wrong money, which is the
       * worst possible form of it: nothing looks broken. Only a full page
       * reload cleared it, and members do not reload.
       *
       * This is one member seeing another's finances, so it runs on EVERY
       * sign-out path - including the one where the logout request failed and
       * the one where storage failed.
       *
       * Clearing after setSession(null) means no query is mounted and
       * refetching as the cache empties.
       */
      queryClient.clear();
    }
  }, [queryClient]);

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
