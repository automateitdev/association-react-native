import * as SecureStore from 'expo-secure-store';

/**
 * Credentials at rest.
 *
 * The token and the association slug go to the platform secure store -
 * Keychain on iOS, Keystore on Android - never to AsyncStorage (FR-APP-8).
 * AsyncStorage is a plaintext file that any backup, and any other process on a
 * rooted device, can read.
 *
 * Nothing else belongs here. SecureStore is small and slow by design; it is for
 * secrets, not for caching.
 */

const TOKEN_KEY = 'bcs.auth.token';
const TENANT_KEY = 'bcs.tenant.slug';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/**
 * The association is asked for once, at first launch, and remembered.
 *
 * It is NOT cleared on sign-out: a member signing out of their phone has not
 * changed which association they belong to, and re-typing a slug every time is
 * friction with no security value. Changing it is a deliberate action.
 */
export async function getTenantSlug(): Promise<string | null> {
  return SecureStore.getItemAsync(TENANT_KEY);
}

export async function setTenantSlug(slug: string): Promise<void> {
  await SecureStore.setItemAsync(TENANT_KEY, slug);
}

export async function clearTenantSlug(): Promise<void> {
  await SecureStore.deleteItemAsync(TENANT_KEY);
}

/** Sign-out: drop the token, keep the association. */
export async function clearSession(): Promise<void> {
  await clearToken();
}
