import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Credentials at rest.
 *
 * On a device the token and association slug go to the platform secure store -
 * Keychain on iOS, Keystore on Android - never to AsyncStorage (FR-APP-8).
 * AsyncStorage is a plaintext file that any backup, and any process on a rooted
 * device, can read.
 *
 * ON WEB THIS IS NOT SECURE STORAGE.
 * ---------------------------------
 * expo-secure-store has no web implementation at all: calling it in a browser
 * throws `getValueWithKeyAsync is not a function`. Web falls back to
 * localStorage, which is readable by any script on the origin.
 *
 * That is acceptable ONLY because web is a development surface and the
 * React Native Web escape hatch for staff screens (risk R-3) - it is not a
 * shipping member target. If web ever becomes one, this needs a real answer:
 * a short-lived token, an httpOnly cookie, or both. Flagged here rather than
 * discovered later.
 */

const TOKEN_KEY = 'bcs.auth.token';
const TENANT_KEY = 'bcs.tenant.slug';

const isWeb = Platform.OS === 'web';

async function read(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      // Private browsing, or storage disabled entirely.
      return null;
    }
  }

  return SecureStore.getItemAsync(key);
}

async function write(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Nothing useful to do: the caller cannot fix a browser that refuses
      // storage, and failing the sign-in over it would be worse.
    }
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function remove(key: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // As above.
    }
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

export async function getToken(): Promise<string | null> {
  return read(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await write(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await remove(TOKEN_KEY);
}

/**
 * The association is asked for once, at first launch, and remembered.
 *
 * NOT cleared on sign-out: signing out of a phone has not changed which
 * association someone belongs to, and re-typing a slug every time is friction
 * with no security value. Changing it is a deliberate action.
 */
export async function getTenantSlug(): Promise<string | null> {
  return read(TENANT_KEY);
}

export async function setTenantSlug(slug: string): Promise<void> {
  await write(TENANT_KEY, slug);
}

export async function clearTenantSlug(): Promise<void> {
  await remove(TENANT_KEY);
}

/** Sign-out: drop the token, keep the association. */
export async function clearSession(): Promise<void> {
  await clearToken();
}

/**
 * A non-secret preference, such as the chosen theme.
 *
 * Deliberately NOT routed through SecureStore on native. The Keychain is for
 * credentials; putting a colour scheme in it is both slower and misleading
 * about what the store is for. AsyncStorage is not a dependency here, so on
 * native this is in-memory for now and the preference simply does not survive a
 * restart there - stated rather than pretended otherwise.
 */
const prefs = new Map<string, string>();

export async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  return prefs.get(key) ?? null;
}

export async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Nothing useful to do.
    }
    return;
  }

  prefs.set(key, value);
}
