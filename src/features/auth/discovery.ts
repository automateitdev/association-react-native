import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Working out which association this is, without asking.
 *
 * WHY ASKING AT ALL IS NOT A SECURITY MATTER. The slug is a routing key, not a
 * credential: `X-Tenant` only chooses which database the API opens, and
 * authentication happens inside it. A token issued by one association is
 * meaningless at another (ADR-0002). So nothing here is protecting a secret —
 * it is removing a step that most people should never have seen.
 *
 * WHY IT CANNOT SIMPLY BE LOOKED UP FROM A MOBILE NUMBER. That would need a
 * central index of who belongs where, which the SRS forbids outright — the
 * central database must hold no member names or mobile numbers — and it would
 * hand anyone an oracle: type a number, learn which societies that person
 * belongs to.
 *
 * SO THE ASSOCIATION HAS TO TRAVEL WITH THE APPROACH, and there are two honest
 * ways for it to arrive:
 *
 *   1. THE HOST. `demo-one.bcsapp.com` says it outright, and the API already
 *      resolves a tenant from the host against its `domains` table. Only
 *      domains the platform registered resolve, so this cannot be spoofed by
 *      pointing your own DNS at us.
 *
 *   2. A LINK the association sent. `?association=demo-one`, or the `/join`
 *      route on native.
 *
 * A NOTE ON LINK SECURITY, because it is the part that actually matters. On
 * native this should be reached through a VERIFIED https link — Android App
 * Links via `assetlinks.json`, iOS Universal Links via
 * `apple-app-site-association` — and not through a custom `bcsapprn://` scheme.
 * A custom scheme is not exclusive: any app on the device can register the same
 * one and intercept the link. The slug leaking matters little; the next screen
 * matters a lot, because an app that hijacked the link could present a
 * convincing sign-in and capture the password typed into it. The verification
 * files have to be served from the production domain, which does not exist yet,
 * so `/join` is currently reachable by scheme and must be moved behind verified
 * links before it is advertised to members.
 */

/**
 * The domain associations are served under, e.g. `bcsapp.com`.
 *
 * Configured rather than assumed, because the same build runs on localhost, on
 * a staging domain and in production, and guessing wrong would silently pick a
 * slug out of a hostname that never meant one.
 */
const HOST_SUFFIX: string | undefined = (
  Constants.expoConfig?.extra as { tenantHostSuffix?: string } | undefined
)?.tenantHostSuffix;

/** Hosts that never carry an association, whatever else the rules say. */
const NEVER_A_TENANT = ['localhost', '127.0.0.1', '0.0.0.0', 'www'];

/**
 * The association implied by where the app is being served from.
 *
 * Web only: a native build has no meaningful hostname. Returns null rather than
 * guessing, and every caller treats null as "ask".
 */
export function tenantFromHost(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  const host = window.location.hostname.toLowerCase();

  if (NEVER_A_TENANT.includes(host) || !HOST_SUFFIX) {
    return null;
  }

  if (!host.endsWith(`.${HOST_SUFFIX}`)) {
    return null;
  }

  const label = host.slice(0, -(HOST_SUFFIX.length + 1));

  /*
   * One label only. `a.b.bcsapp.com` is not association `a.b` - it is
   * something we did not design for, and picking the first label out of it
   * would send somebody into a tenant they did not ask for.
   */
  if (!label || label.includes('.') || NEVER_A_TENANT.includes(label)) {
    return null;
  }

  return isSlug(label) ? label : null;
}

/**
 * The association named in the current URL, e.g. `?association=demo-one`.
 *
 * Web only, and paired with the `/join/[slug]` route that native links use.
 * Both exist so an association can send one link and nobody types a code.
 */
export function tenantFromQuery(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  const value = new URLSearchParams(window.location.search).get('association');

  return value && isSlug(value.trim().toLowerCase()) ? value.trim().toLowerCase() : null;
}

/**
 * A slug pulled out of whatever somebody pasted.
 *
 * People paste the whole link. Accepting only a bare code means the one person
 * who did exactly what they were told - copied the link the association sent -
 * is the one who gets an error, so a URL is unwrapped rather than rejected.
 */
export function slugFromInput(input: string): string | null {
  const text = input.trim();

  if (!text) {
    return null;
  }

  // A link, in any of the shapes one might arrive in.
  const fromQuery = text.match(/[?&]association=([a-z0-9-]+)/i);
  if (fromQuery) {
    return normalise(fromQuery[1]);
  }

  const fromJoin = text.match(/\/join\/([a-z0-9-]+)/i);
  if (fromJoin) {
    return normalise(fromJoin[1]);
  }

  if (HOST_SUFFIX) {
    const escaped = HOST_SUFFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fromHost = text.match(new RegExp(`//([a-z0-9-]+)\\.${escaped}`, 'i'));

    if (fromHost) {
      return normalise(fromHost[1]);
    }
  }

  // Otherwise it should be the code itself. Lower-cased and trimmed, because a
  // phone keyboard capitalises the first letter and nobody means it to.
  return normalise(text);
}

function normalise(value: string): string | null {
  const slug = value.trim().toLowerCase();

  return isSlug(slug) ? slug : null;
}

/** The server's own rule, so a typo fails here rather than as a 422. */
function isSlug(value: string): boolean {
  return /^[a-z][a-z0-9-]{1,49}$/.test(value);
}
