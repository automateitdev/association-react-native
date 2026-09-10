import { useCallback, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { Easing, useReducedMotion as useReanimatedReducedMotion } from 'react-native-reanimated';

/**
 * The motion the screens share.
 *
 * WHY THIS EXISTS, in the same spirit as ui/tokens.
 * ------------------------------------------------
 * The app had no motion at all - Reanimated was installed and not imported
 * once - and the result reads as a document rather than an application. A
 * pressable row gave no answer to a press, a list replaced a spinner with
 * forty rows between one frame and the next, and nothing anywhere
 * acknowledged that it had heard you.
 *
 * The fix is not animation sprinkled per screen. That is how two lists end up
 * fading at different speeds and a third does not fade at all. These are the
 * two numbers - how long, and on what curve - that every animated thing in the
 * app reads from, so consistency is structural rather than remembered.
 *
 * DELIBERATELY SHORT. Interface motion is feedback, not choreography. Anything
 * a person waits for is too slow, and they will meet these hundreds of times a
 * day. The longest value here is under a third of a second, and most of what
 * moves uses `quick`.
 */
export const duration = {
  /** Press feedback. Must feel like a consequence of the finger, not a reply. */
  instant: 90,
  /** The default: tints, fades, small reveals. */
  quick: 140,
  /** Content arriving - a list replacing a spinner. */
  base: 200,
  /** Reserved for something entering from off-screen. Rare on purpose. */
  slow: 300,
} as const;

/**
 * BEZIERS, NOT COMPOSED EASINGS - and this is a correctness matter on web, not
 * a stylistic one.
 *
 * The obvious spelling of these is `Easing.out(Easing.cubic)`. On web
 * Reanimated can only honour an easing it is able to express as a CSS
 * `cubic-bezier`, and a composed easing is not one: it logs
 * "Selected easing is not currently supported on web. Using linear easing
 * instead." and carries on. Linear is the one curve that reads as mechanical -
 * so the staff portal, which IS the web build, would have got the worst
 * possible motion while the phone builds looked correct, with a console
 * warning as the only evidence.
 *
 * `Easing.bezier` is honoured on both. The curves below are the standard
 * ease-out-cubic and ease-in-out-quad, written as their control points.
 */
export const easing = {
  /**
   * For anything ARRIVING. Fast at the start, settling at the end, which reads
   * as a thing coming to rest rather than a thing being drawn.
   */
  out: Easing.bezier(0.33, 1, 0.68, 1),
  /** For anything MOVING from one place to another, or leaving. */
  inOut: Easing.bezier(0.45, 0, 0.55, 1),
} as const;

/**
 * Whether this person has asked their system for less movement.
 *
 * WHY NOT JUST REANIMATED'S HOOK. On native it is used directly. On web it is
 * not trusted alone, for the same reason `useColorScheme` was not: a static
 * export can answer from a default rather than from the browser, and the
 * failure is silent - the setting is ignored and nobody can tell you why.
 * `matchMedia` is the browser's own answer, subscribed to so a change mid-
 * session is honoured rather than requiring a reload.
 *
 * Reduced motion is not a preference about taste. Vestibular disorders make
 * movement genuinely unpleasant, and the people affected have already told
 * their operating system so.
 */
export function useReducedMotion(): boolean {
  const native = useReanimatedReducedMotion();

  const subscribe = useCallback((notify: () => void) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) {
      return () => {};
    }

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    query.addEventListener('change', notify);

    return () => query.removeEventListener('change', notify);
  }, []);

  const web = useSyncExternalStore(
    subscribe,
    () =>
      Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false,
    // Server/static render: assume motion is wanted, then correct on hydration.
    () => false,
  );

  return Platform.OS === 'web' ? web : native;
}

/**
 * Durations that collapse to zero when movement is unwanted.
 *
 * Call sites use `ms(duration.quick)` rather than branching themselves. A
 * zero-length animation still ENDS in the right state, so honouring the
 * setting never means skipping the state change - only the travel to it.
 * Every call site branching for itself is how one screen ends up honouring the
 * setting and four do not.
 */
export function useMotion() {
  const reduced = useReducedMotion();

  return {
    reduced,
    ms: (value: number) => (reduced ? 0 : value),
    duration,
    easing,
  };
}
