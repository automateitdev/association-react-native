import type { ComponentProps } from 'react';
import { Button as HeroButton } from 'heroui-native';
import { useIsDesktop } from './breakpoint';

/**
 * A button sized to this app's type scale.
 *
 * WHY OVERRIDE THE COMPONENT'S OWN HEIGHT
 * ---------------------------------------
 * HeroUI's smallest button is 40pt (`sm` is spacing x 10) and its medium is 48.
 * Those are touch targets, and they are correct for a phone. Against 13.5pt body
 * text on a desktop they are enormous - a control half again the height of the
 * row beside it, which is what made the buttons look bolted on rather than part
 * of the page.
 *
 * The principle: a control's height should relate to the text it sits among. At
 * 13.5pt body, 32pt is about a 2.4x line box, which is the proportion desktop
 * software actually uses. HeroUI's `sm` is 3x.
 *
 * IT STAYS 40pt ON A PHONE, and that is not an oversight. 32pt is below the
 * 44pt minimum touch target; shrinking a control that a thumb has to hit would
 * trade a real usability problem for an aesthetic one. This is the one place in
 * the app where phone and desktop need genuinely different numbers rather than
 * the same number tuned - everywhere else the tighter value suits both.
 *
 * Height is overridden rather than padding because the component computes its
 * own padding from `size`, and fighting that produces off-centre labels.
 */
export function Button({
  size = 'sm',
  compact = true,
  style,
  ...props
}: ComponentProps<typeof HeroButton> & {
  /**
   * Set false to keep the library's full height for a control that wants the
   * weight - a lone "Pay now" on a member's screen, for instance.
   */
  compact?: boolean;
}) {
  const isDesktop = useIsDesktop();

  return (
    <HeroButton
      size={size}
      style={[compact && isDesktop ? { height: 32, borderRadius: 8 } : null, style]}
      {...props}
    />
  );
}

// Used as `Button.Label` throughout, so the compound parts come along.
Button.Label = HeroButton.Label;
Button.Background = HeroButton.Background;
