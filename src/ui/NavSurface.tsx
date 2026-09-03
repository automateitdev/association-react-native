import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useThemeColorReader } from './themeColor';

/**
 * The ground the navigation rail stands on.
 *
 * WHY THE RAIL NEEDS ONE AT ALL
 * -----------------------------
 * It had none. The navigator paints its own rail with `colors.card`, we hand it
 * `surface`, and React Native Web dropped the value on the way in - see
 * themeColor.ts for the mechanism. The rail computed to `rgba(0, 0, 0, 0)` and
 * the page ground showed straight through, so the navigation and the content it
 * navigates were the same colour with nothing between them.
 *
 * WHY A GRADIENT, AND WHAT IS ACTUALLY DOING THE WORK
 * --------------------------------------------------
 * Two different things are being asked of this, and it is worth being clear
 * about which one matters:
 *
 *   - The SEPARATION comes from the value step and the hairline. The rail sits
 *     on `surface`, the same plane as the app bar above it, so chrome reads as
 *     one continuous surface wrapping the top and left of the window and the
 *     content reads as the page laid on it. That is what fixes the complaint.
 *
 *   - The GRADIENT is the finish. On its own it would not have separated
 *     anything - a gradient between two colours nobody can tell apart is still
 *     one colour.
 *
 * It fades DOWNWARD, from full surface where the rail meets the app bar to a
 * wash of it at the foot. That is the direction light falls, and it keeps the
 * busy corner - where the app bar, the rail and the first nav item all meet -
 * as the most defined part of the screen, which is also where the eye starts.
 *
 * It never reaches the page colour. The bottom stop is `surface` at 45% over
 * the page, not the page itself, so the rail stays a distinct plane for its
 * whole height even where it is empty.
 *
 * SVG RATHER THAN A CSS GRADIENT
 * ------------------------------
 * `backgroundImage` is not a React Native style property, and Tailwind's
 * gradient utilities are a web-only answer. react-native-svg is already a
 * dependency and renders real SVG on web and natively on a device, so this is
 * one implementation rather than a web path and a native path that drift.
 */
export function NavSurface({
  scheme,
  sidebar,
}: {
  scheme: 'light' | 'dark';
  /** A left rail gets the gradient; the phone's bottom bar stays flat. */
  sidebar: boolean;
}) {
  const themeColor = useThemeColorReader(scheme);

  const surface = themeColor('surface');
  const background = themeColor('background');
  const border = themeColor('border');

  /*
   * The hairline is drawn HERE rather than left to the navigator.
   *
   * The navigator always draws one, from `colors.border` - which is dropped by
   * the same normalisation that dropped the background, leaving borderColor at
   * its CSS initial value of pure black. Invisible on the dark theme, and a
   * black line down the light one. The layouts set its width to 0 and it is
   * replaced with this.
   */
  const edge = sidebar
    ? { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: border }
    : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border };

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: surface }, edge]}
      // Decoration behind the tabs. Without this it would sit over them on web
      // and swallow every press.
      pointerEvents="none"
    >
      {sidebar ? (
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            {/*
              The id is scoped by scheme so the two themes cannot share a stale
              definition - SVG gradient ids are global to the document.
            */}
            <LinearGradient id={`nav-rail-${scheme}`} x1="0" y1="0" x2="0" y2="1">
              {/* Transparent at the top: the surface underneath shows through
                  unchanged, so the rail and the app bar meet with no seam. */}
              <Stop offset="0" stopColor={background} stopOpacity="0" />
              <Stop offset="1" stopColor={background} stopOpacity="0.55" />
            </LinearGradient>
          </Defs>

          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#nav-rail-${scheme})`} />
        </Svg>
      ) : null}
    </View>
  );
}
