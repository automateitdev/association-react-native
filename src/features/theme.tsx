import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { Platform, useColorScheme } from 'react-native';
import { getItem, setItem } from '@/api/storage';

export type ThemePreference = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  /** What the user chose. */
  preference: ThemePreference;
  /** What that resolves to right now, once `system` is taken into account. */
  scheme: 'light' | 'dark';
  setPreference: (preference: ThemePreference) => void;
  /** Cycles light → dark → system. */
  cycle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const KEY = 'bcs.theme';

/**
 * The theme the user asked for, remembered.
 *
 * THREE STATES, NOT TWO.
 * A plain light/dark switch cannot express "follow my machine", which is what
 * most people actually want and what the app did before there was a control at
 * all. Losing that in order to gain a toggle would be a downgrade for anyone
 * happy with the default, so `system` stays and is the default.
 *
 * The preference is stored, because a theme that resets on every launch is
 * worse than no control: the user has to keep re-making a decision they already
 * made.
 */
/**
 * Does the machine want dark? Asked of the BROWSER on web, not of React Native.
 *
 * WHY NOT useColorScheme
 * ----------------------
 * In a static export it answers `light` on a machine that is plainly in dark
 * mode - measured on the deployed build: `matchMedia('(prefers-color-scheme:
 * dark)').matches` was true, RN's hook said light. The page is prerendered at
 * build time, where there is no `window`, and react-native-web's Appearance
 * carries that answer into the browser.
 *
 * What made it a VISIBLE bug rather than a cosmetic one is that the app has two
 * paths to the palette and this broke the agreement between them: ScopedTheme
 * scopes CSS variables from `scheme`, while uniwind's own machinery marks
 * <html> from the media query. So the wrapper said light and <html> said dark -
 * cream surfaces carrying near-white text. Unreadable, and only for people
 * whose system is in dark mode, which is why it survived development.
 *
 * useSyncExternalStore rather than useState + useEffect, because it is the one
 * shape React hydrates correctly: the server snapshot is used for hydration, so
 * the markup matches, and the real value is read immediately afterwards.
 */
function useSystemScheme(): 'light' | 'dark' {
  const nativeScheme = useColorScheme();

  const webScheme = useSyncExternalStore(
    subscribeToColorScheme,
    readColorScheme,
    // Prerender has no window. `light` matches what the export bakes in.
    () => 'light' as const,
  );

  return Platform.OS === 'web' ? webScheme : nativeScheme === 'dark' ? 'dark' : 'light';
}

function subscribeToColorScheme(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }

  const query = window.matchMedia('(prefers-color-scheme: dark)');
  query.addEventListener('change', onChange);

  return () => query.removeEventListener('change', onChange);
}

function readColorScheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stored = await getItem(KEY);
        if (!cancelled && (stored === 'light' || stored === 'dark' || stored === 'system')) {
          setPreferenceState(stored);
        }
      } catch {
        // An unreadable preference is not worth failing over; `system` is a
        // perfectly good answer.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    // Applied immediately and persisted in the background - waiting on storage
    // to repaint would make the toggle feel broken.
    setPreferenceState(next);
    void setItem(KEY, next).catch(() => {});
  }, []);

  const cycle = useCallback(() => {
    setPreference(preference === 'light' ? 'dark' : preference === 'dark' ? 'system' : 'light');
  }, [preference, setPreference]);

  const scheme: 'light' | 'dark' = preference === 'system' ? systemScheme : preference;

  /*
   * Mirror the choice onto <html> on web.
   *
   * ScopedTheme scopes the palette to a wrapper it renders, which is right for
   * everything inside the app - but two things sit outside it and were left on
   * the system's theme: the page ground painted by global.css, and anything
   * reading a variable from :root.
   *
   * The result was a half-switched app - cards turned light while the page
   * behind them and the sidebar stayed dark. Measured: --foreground read dark
   * inside the wrapper and light on <html> at the same moment.
   *
   * DURING RENDER, NOT IN AN EFFECT.
   * This began as a useEffect, which is the ordinary place for it, and that was
   * a render too late for anything reading the palette back out of the
   * document. ui/themeColor.ts does exactly that, and the ordering is: this
   * provider renders -> its children render and READ -> effects run and the
   * class finally changes. So the navigation rail resolved its colours from the
   * OLD theme and stayed dark against a light page until something else forced
   * it to render again.
   *
   * Writing to the DOM during render is normally worth avoiding. Here it is
   * idempotent, touches nothing React manages, and is the only ordering in
   * which a synchronous read by a descendant can be correct.
   *
   * Web only, and deliberately so: there is no document on native, where
   * ScopedTheme alone is the whole mechanism.
   */
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const root = document.documentElement;

    if (!root.classList.contains(scheme)) {
      root.classList.remove('light', 'dark');
      root.classList.add(scheme);
    }
  }

  const value = useMemo(
    () => ({ preference, scheme, setPreference, cycle }),
    [preference, scheme, setPreference, cycle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }

  return context;
}
