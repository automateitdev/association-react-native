import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

/**
 * Is there room for a desktop layout?
 *
 * WHY THIS EXISTS
 * ---------------
 * The app was built phone-first and stayed that way on every surface, so on a
 * 1280pt browser it rendered a 720pt column with 280pt of dead space either side
 * and a bottom tab bar pinned to the bottom of the window. That is phone chrome
 * on a desktop, and it reads as one.
 *
 * It also contradicted the plan. R-3 names React Native Web as the surface where
 * report-heavy staff work actually happens, precisely because that work is
 * awkward on a phone. A staff member on a desktop should get a desktop.
 *
 * 1024 rather than a device check: what matters is available width, not what
 * kind of machine it is. A tablet in landscape gets the sidebar and should; a
 * narrow browser window gets the phone layout and should.
 *
 * WHY WEB USES matchMedia RATHER THAN useWindowDimensions
 * -------------------------------------------------------
 * `useWindowDimensions()` alone did not re-render on a browser resize here. It
 * was correct on mount - 1280 gave the sidebar, 900 gave bottom tabs, both
 * verified - but dragging the window across the breakpoint changed nothing, and
 * neither did dispatching a `resize` event by hand. The layout only corrected
 * itself on reload.
 *
 * `matchMedia` is the browser's own answer to this question and fires reliably,
 * so web listens to that and native keeps `useWindowDimensions`, which is the
 * right API there and where the resize problem does not arise.
 */
export const DESKTOP_BREAKPOINT = 1024;

const QUERY = `(min-width: ${DESKTOP_BREAKPOINT}px)`;

export function useIsDesktop(): boolean {
  // Hooks cannot be conditional, so both run; only one result is used.
  const { width } = useWindowDimensions();
  const [matches, setMatches] = useState(() =>
    Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(QUERY).matches
      : false,
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return;

    const list = window.matchMedia(QUERY);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);

    // Sync once on mount: the query may already have changed between the
    // initial state and this effect running.
    setMatches(list.matches);
    list.addEventListener('change', onChange);

    return () => list.removeEventListener('change', onChange);
  }, []);

  return Platform.OS === 'web' ? matches : width >= DESKTOP_BREAKPOINT;
}

/**
 * How wide the content may run.
 *
 * Two measures, because two kinds of screen want opposite things:
 *
 *   reading  A form or a page of prose. Long lines are harder to read and a
 *            text input stretched to 1000pt looks broken, so this stays near a
 *            comfortable measure even when there is room for more.
 *
 *   wide     A list, a dashboard or a table. These get all the room going -
 *            more columns visible without scrolling is the entire benefit of
 *            being on a desktop.
 */
export function useContentWidth(kind: 'reading' | 'wide'): number {
  const isDesktop = useIsDesktop();

  if (!isDesktop) {
    // On a phone the cap never binds; the viewport is the constraint.
    return 720;
  }

  return kind === 'reading' ? 760 : 1280;
}
