import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useThemeColor } from 'heroui-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Text } from './Text';
import { Icon } from './Icon';
import { Divider } from './Section';
import { useMotion } from './motion';
import { space, type } from './tokens';

/**
 * One item in a list.
 *
 * Replaces the card-per-item pattern. A list of eight members was eight filled
 * boxes with borders and internal padding, stacked with gaps between them -
 * roughly forty edges on screen to communicate eight things. A row separated by
 * a hairline communicates the same grouping with one.
 *
 * The layout is fixed on purpose: title and meta on the left, one figure or
 * control on the right. Every list in this app is that shape, and letting each
 * screen improvise its own would put the app back where it started.
 */
export function Row({
  title,
  meta,
  trailing,
  leading,
  footer,
  onPress,
  chevron,
  divider = true,
}: {
  title: string;
  /** One line of supporting detail. Two would be a different component. */
  meta?: string;
  /** The figure or control the row is about. */
  trailing?: ReactNode;
  /** A checkbox or avatar. */
  leading?: ReactNode;
  /** A warning or extra line below - used sparingly. */
  footer?: ReactNode;
  onPress?: () => void;
  /**
   * Whether pressing the row GOES somewhere.
   *
   * Defaults to "yes, if it is pressable at all", which is right for most
   * lists. Pass false when the press does something in place - selecting the
   * row, toggling a checkbox - because then the chevron promises a destination
   * that does not exist, and on a row that already carries a checkbox it
   * contradicts the control beside it.
   */
  chevron?: boolean;
  divider?: boolean;
}) {
  const showChevron = chevron ?? Boolean(onPress);
  const body = (
    // ~38pt rows rather than ~66. A desktop list is scanned, not tapped through,
    // and density is what makes scanning possible.
    <View style={{ paddingVertical: space.sm, gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        {leading}

        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.rowTitle}>{title}</Text>
          {meta ? (
            <Text tone="muted" style={type.rowMeta}>
              {meta}
            </Text>
          ) : null}
        </View>

        {trailing}

        {/*
          A chevron only when the row actually leads somewhere. Without it a
          pressable row is indistinguishable from a static one, and people stop
          trying rows that would have worked - and with it on a row that only
          selects, they tap expecting a screen and get a tick.
        */}
        {showChevron ? <Icon name="chevron" size={18} tone="muted" /> : null}
      </View>

      {footer}
    </View>
  );

  return (
    <View>
      {onPress ? <PressableRow onPress={onPress}>{body}</PressableRow> : body}
      {divider ? <Divider /> : null}
    </View>
  );
}

/**
 * A row that answers the finger.
 *
 * WHY A TINT AND NOT AN OPACITY FADE. Dimming the content says "this is
 * becoming unavailable"; lighting the surface behind it says "I have this
 * one". They are opposite messages and the second is the true one - the row is
 * about to do something, not about to stop.
 *
 * WHY NO SCALE. A full-width row scaling under a press drags every word in it
 * a fraction sideways, and on the web that re-rasterises the text: a shimmer
 * across the whole line, at exactly the moment somebody is looking at it.
 * Scale belongs on things narrower than the screen.
 *
 * The tint arrives in `instant` and leaves in `quick`: a press should feel
 * like a consequence of the finger, but the release is the end of something
 * and can afford to be seen. Symmetric timing makes taps feel mechanical.
 */
function PressableRow({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  const { ms, duration, easing } = useMotion();
  const tint = useThemeColor('surface-secondary');
  const pressed = useSharedValue(0);

  const overlay = useAnimatedStyle(() => ({ opacity: pressed.value }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: ms(duration.instant), easing: easing.out });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: ms(duration.quick), easing: easing.inOut });
      }}
    >
      {/*
        Behind the content rather than over it, and inert to pointers - an
        overlay that swallowed the press would be a highlight that stops the
        row working.
      */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: tint, pointerEvents: 'none' }, overlay]}
      />

      {children}
    </Pressable>
  );
}

/**
 * A label and a value on one line.
 *
 * For detail screens, where the content is a record rather than a list. Reads
 * as a definition list; deliberately quieter than a Row.
 */
export function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: space.lg,
        paddingVertical: space.sm,
      }}
    >
      <Text tone="muted" style={type.rowMeta}>
        {label}
      </Text>
      <Text style={{ ...type.body, flexShrink: 1, textAlign: 'right' }}>{value || '—'}</Text>
    </View>
  );
}
