import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Icon } from './Icon';
import { Text } from './Text';
import { Appear } from './Appear';
import { useMotion } from './motion';
import { space, type } from './tokens';

/**
 * A section that opens, for a form too long to read all of at once.
 *
 * WHY THIS RATHER THAN A STEP WIZARD, which is what the legacy uses. The
 * legacy form is a REGISTRATION: you fill everything, once, in order, and
 * Next/Next/Finish is exactly right for that. This form is a CHANGE REQUEST,
 * and the job is almost always "correct one thing" - so a wizard would make
 * somebody walk three steps to fix a mobile number, and hide the Send button
 * behind the last of them.
 *
 * AND WHY NOT TABS. Tabs show one section and hide the others, which is fine
 * until a single Send button reports "3 changes" while the reader can see one.
 * A member would have to open every tab to find out what they are about to
 * ask for.
 *
 * So: everything on one page, collapsed, with each section saying how much is
 * changed inside it. Nothing is hidden from the count, the whole scope of the
 * form reads as three lines, and opening one costs a tap.
 *
 * THE SUMMARY IS THE POINT. A disclosure whose header says only its title
 * makes a reader open all of them to find anything - which is the wall of
 * fields again, plus three taps. `meta` is what makes a collapsed section
 * still worth reading.
 */
export function Disclosure({
  title,
  meta,
  /** Open on first render. Use for the section somebody most likely came for. */
  defaultOpen = false,
  /** Draws the reader's eye to a section holding unsent edits. */
  highlighted = false,
  children,
}: {
  title: string;
  meta?: string;
  defaultOpen?: boolean;
  highlighted?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const motion = useMotion();
  const turn = useSharedValue(defaultOpen ? 1 : 0);

  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value * 90}deg` }],
  }));

  const toggle = () => {
    const next = !open;

    setOpen(next);
    // `ms()` collapses to zero when movement is unwanted, so the chevron still
    // ENDS in the right place - only the travel to it is skipped.
    turn.value = withTiming(next ? 1 : 0, {
      duration: motion.ms(motion.duration.quick),
      easing: motion.easing.inOut,
    });
  };

  return (
    <View
      className={
        highlighted ? 'border border-accent rounded-field' : 'border border-border rounded-field'
      }
    >
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        // RN Web maps neither spelling from the other - the same gap as
        // ui/AnchoredSelect and ui/Icon. Both, or a screen reader is told
        // nothing about a control whose whole job is opening.
        aria-expanded={open}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
        }}
      >
        {/*
          THE CHEVRON TURNS RATHER THAN SWAPPING between two glyphs. A swap is
          a state change with no motion in it, and on a control whose entire
          meaning is "this opens downward" the rotation is the affordance.
        */}
        <Animated.View style={chevron}>
          <Icon name="chevron" size={16} tone={open ? 'accent' : 'muted'} />
        </Animated.View>

        <Text style={{ ...type.rowTitle, flex: 1 }}>{title}</Text>

        {meta ? (
          <Text tone={highlighted ? 'accent' : 'muted'} style={type.rowMeta}>
            {meta}
          </Text>
        ) : null}
      </Pressable>

      {/*
        MOUNTED ONLY WHILE OPEN, which is the half that matters on a form this
        long: three sections of inputs all mounted is three sections competing
        for the keyboard and re-rendering on every keystroke in any of them.
        Their VALUES live in the form above, so nothing is lost by unmounting -
        a member who types into the nominee, collapses it, and sends still
        sends what they typed.
      */}
      {open ? (
        <Appear distance={4}>
          <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}>{children}</View>
        </Appear>
      ) : null}
    </View>
  );
}
