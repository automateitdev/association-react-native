import { useMemo } from 'react';
import { useThemeColor } from 'heroui-native';

/**
 * A theme colour as a string a React Native style will actually accept.
 *
 * WHY THIS IS NOT JUST getPropertyValue
 * -------------------------------------
 * Anything of ours takes a `className` and lets CSS resolve the colour. This
 * exists for the third-party components that cannot: react-navigation wants
 * concrete colour STRINGS and freezes them into inline styles.
 *
 * Two separate traps sit on that path, and both were live.
 *
 * 1. useThemeColor tracks the SYSTEM colour scheme, not the theme ScopedTheme
 *    is applying, so after a manual switch it kept handing back the old
 *    palette - the page ground and the sidebar stayed dark while every
 *    CSS-driven surface went light. Hence reading the document, keyed on
 *    `scheme` so it recomputes on every switch.
 *
 * 2. The palette is authored in oklch, which the browser serialises as
 *    `lab(10.166% .254571 6.19023)`. React Native Web runs every colour in an
 *    inline style through normalizeColor, which understands hex, rgb(), hsl()
 *    and named colours - and NOTHING ELSE. A lab() string is not rejected
 *    loudly; it is DROPPED.
 *
 *    That is why the sidebar and the page were the same colour. The navigator
 *    paints its rail with `colors.card`, we hand it `surface`, and the value
 *    evaporated on the way in - measured: the 220pt rail computed to
 *    `rgba(0, 0, 0, 0)`, so the page ground showed straight through it. Its
 *    hairline went the same way and fell back to the CSS initial value, pure
 *    black, which is invisible on the dark theme and would have been a black
 *    line down the light one.
 *
 *    Nothing warns. The style object looks correct in JS; the property is
 *    simply absent from the computed style.
 *
 * So the value is converted to sRGB before it is handed over. `color-mix(in
 * srgb, ...)` is what forces the conversion - assigning the lab() string
 * directly and reading it back returns lab() again, since Chrome serialises a
 * computed colour in its own space.
 */

/** The tokens this may be asked for. Keyed so a typo is a type error. */
const TOKENS = [
  'accent',
  'accent-foreground',
  'background',
  'foreground',
  'surface',
  'surface-secondary',
  'muted',
  'border',
] as const;

export type ThemeToken = (typeof TOKENS)[number];

export type ThemeColorReader = (name: ThemeToken) => string;

export function useThemeColorReader(scheme: 'light' | 'dark'): ThemeColorReader {
  /*
   * Every token is read up front. Hooks cannot be called from inside the
   * returned function, and these are the fallbacks for native - where there is
   * no document, and where useThemeColor is correct anyway because ScopedTheme
   * is the only mechanism in play.
   */
  const fallbacks: Record<ThemeToken, string> = {
    accent: useThemeColor('accent'),
    'accent-foreground': useThemeColor('accent-foreground'),
    background: useThemeColor('background'),
    foreground: useThemeColor('foreground'),
    surface: useThemeColor('surface'),
    'surface-secondary': useThemeColor('surface-secondary'),
    muted: useThemeColor('muted'),
    border: useThemeColor('border'),
  };

  return useMemo(() => {
    return (name: ThemeToken): string => {
      if (typeof document === 'undefined') return fallbacks[name];

      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue(`--color-${name}`)
        .trim();

      if (!raw) return fallbacks[name];

      return toRgbString(raw) ?? fallbacks[name];
    };
    // `scheme` is the dependency that matters: the variables change underneath
    // us when it does, and nothing else signals that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheme, ...TOKENS.map((token) => fallbacks[token])]);
}

/**
 * Any CSS colour, as `rgb()` - the form React Native Web can normalise.
 *
 * Returns null rather than a guess if the browser hands back something
 * unexpected, so the caller falls back to a colour that is at least valid.
 */
function toRgbString(value: string): string | null {
  const probe = document.createElement('div');

  // color-mix is what actually performs the conversion. The colour is mixed
  // with nothing at all - 100% of itself - purely to name `srgb` as the space
  // the result must be computed in.
  probe.style.setProperty('color', `color-mix(in srgb, ${value} 100%, transparent)`);

  // Chrome only computes a colour for an element that is in the document.
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();

  // Already usable - a palette authored in hex or rgb never reaches the
  // conversion below.
  if (/^rgba?\(/.test(computed)) return computed;

  // `color(srgb 0.119982 0.107879 0.0753603)`: in sRGB now, but still in a
  // notation normalizeColor does not read.
  const srgb = computed.match(
    /^color\(srgb\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)(?:\s*\/\s*([\d.eE+-]+))?\s*\)$/,
  );

  if (!srgb) return null;

  const channel = (raw: string) => Math.max(0, Math.min(255, Math.round(Number(raw) * 255)));
  const [, r, g, b, alpha] = srgb;
  const rgb = `${channel(r)}, ${channel(g)}, ${channel(b)}`;

  return alpha === undefined || Number(alpha) === 1
    ? `rgb(${rgb})`
    : `rgba(${rgb}, ${Number(alpha)})`;
}
