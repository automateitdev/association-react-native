import type { ComponentProps } from 'react';
import { Typography, useThemeColor } from 'heroui-native';
import { font } from './tokens';

type Tone = 'default' | 'muted' | 'danger' | 'accent' | 'inverse';

/**
 * Text with a theme-resolved tone.
 *
 * WHY THIS EXISTS - A BUG THAT LOOKED LIKE A DESIGN
 * ------------------------------------------------
 * The design layer originally set secondary and warning text with Uniwind
 * utilities: `className="text-muted"`, `className="text-danger"`. Those had NO
 * EFFECT, and nothing failed to say so.
 *
 * HeroUI's `Typography` applies its own colour through a component class
 * (`text__root--color-default`), not a Tailwind utility, so a `text-muted`
 * utility never conflicts with it and never wins - the two live in different
 * class namespaces. Every label, every caption and every "No slip attached"
 * warning rendered in the same near-white as the primary text.
 *
 * The screens still LOOKED plausible, which is what made it worth a component:
 * the layout was right, the hierarchy was simply absent, and the only way to
 * catch it was to read the computed colour off four different elements and
 * notice they were identical.
 *
 * `useThemeColor` resolves the theme's own token to a real colour string, which
 * an inline style then applies with nothing to conflict with. Muted still goes
 * through Typography's own `color` prop, which is the sanctioned path for it.
 */
export function Text({
  tone = 'default',
  style,
  ...props
}: ComponentProps<typeof Typography> & { tone?: Tone }) {
  // Hooks cannot be conditional, so both are read regardless of tone.
  const danger = useThemeColor('danger');
  const accent = useThemeColor('accent');
  // Text sitting ON an accent ground - a selected calendar day, a filled chip.
  // The palette defines a colour for exactly this; guessing white breaks in the
  // light theme, where the accent is a deep olive but not dark enough for it.
  const inverse = useThemeColor('accent-foreground');

  /*
   * Inter by default, so text with no explicit style still gets the typeface.
   *
   * `style` comes after, so anything from the type scale - which names its own
   * weight's family - overrides this. Without the default, every string not
   * passed a type token rendered in the system font, which is a scattering of
   * mismatched text across otherwise styled screens.
   */
  const base = { fontFamily: font.regular };

  if (tone === 'muted') {
    return <Typography color="muted" style={[base, style]} {...props} />;
  }

  if (tone === 'default') {
    return <Typography style={[base, style]} {...props} />;
  }

  return (
    <Typography
      style={[
        base,
        { color: tone === 'danger' ? danger : tone === 'inverse' ? inverse : accent },
        style,
      ]}
      {...props}
    />
  );
}
