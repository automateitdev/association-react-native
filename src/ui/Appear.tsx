import type { ReactNode } from 'react';
import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useMotion } from './motion';

/**
 * Content arriving, rather than content appearing.
 *
 * WHAT THIS IS FOR. A spinner replaced by twenty-five rows between one frame
 * and the next is the single most abrupt thing this app did. There is no
 * moment where anything moved, so the eye has nothing to follow and has to
 * re-find its place on a page that changed completely while it blinked.
 *
 * A fade with a few points of upward travel gives that moment. The travel
 * matters more than the fade: motion upward reads as settling into place,
 * which is the honest description of what just happened.
 *
 * DELIBERATELY SMALL AND UNCONFIGURABLE-ISH. `distance` defaults to 6pt
 * because anything larger turns a list arriving into a list being thrown at
 * you, and on a long table the bottom rows would still be travelling while the
 * top ones had stopped. Twenty-five rows sliding in from below is a screensaver.
 *
 * ONE WRAPPER, NO PER-CHILD ANIMATION. The whole block moves as one. Staggering
 * each row would be prettier in a screenshot and worse to use: the last row
 * would arrive a third of a second after the first, and until then the list
 * has a length that keeps changing under the scrollbar.
 */
export function Appear({
  children,
  delay = 0,
  distance = 6,
  style,
}: {
  children: ReactNode;
  /** For the rare case of two blocks that should arrive in order. */
  delay?: number;
  /** Points travelled upward. Zero for something that must not move at all. */
  distance?: number;
  /**
   * The wrapper carries no layout of its own by default - it is a plain box
   * around the content. Pass `flex: 1` here when the thing inside needs to
   * fill its parent, or the extra level in the tree will collapse it.
   */
  style?: StyleProp<ViewStyle>;
}) {
  const { ms, duration, easing } = useMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      ms(delay),
      withTiming(1, { duration: ms(duration.base), easing: easing.out }),
    );

    /*
     * THE CONTENT MUST NOT DEPEND ON THE ANIMATION FINISHING.
     *
     * On the web `withTiming` advances on requestAnimationFrame, and a browser
     * stops calling that in a tab that is not being painted - a page opened in
     * a background tab, a window behind another, a machine saving power. The
     * animation then freezes wherever it reached and STAYS there: measured at
     * opacity 0.289 four seconds after mount in a hidden tab. That is a report
     * of somebody's dues rendered permanently at a quarter visible.
     *
     * Timers keep running when frames do not, so this snaps the end state into
     * place if the animation has not arrived under its own power. In a normal
     * tab it fires long after the animation finished and assigns 1 over 1,
     * which costs nothing and does nothing.
     *
     * The general rule this is an instance of: an entrance may decide HOW
     * content appears, never WHETHER it does.
     */
    const safety = setTimeout(
      () => {
        progress.value = 1;
      },
      ms(delay) + ms(duration.base) + 600,
    );

    return () => clearTimeout(safety);
    // Mount only. Re-running this on a prop change would replay the entrance
    // every time a parent re-rendered, which is how a list ends up flickering
    // on every keystroke of a search box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
