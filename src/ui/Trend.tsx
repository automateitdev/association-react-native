import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Icon } from './Icon';
import { useMotion } from './motion';
import { Text } from './Text';
import { space, type } from './tokens';

/**
 * A short series as bars - six months of collections, say - with up to two
 * measures per point.
 *
 * NO CHART LIBRARY, and that is a deliberate limit rather than a stopgap. What
 * this draws is a dozen rectangles and six labels; a charting dependency would
 * bring axes, tooltips, animation and a second theming system to do it, and
 * every one of those is a thing to keep in step with the rest of the app.
 *
 * TWO SERIES, SIDE BY SIDE, NEVER STACKED. Stacking instalments and fines would
 * draw their sum, and the one figure this platform never produces is that sum -
 * a bar whose height is "collected" including penalties is defect D-1 as a
 * picture. Side by side is comparison, which is the useful question anyway:
 * are penalties growing against subscriptions?
 *
 * PROPORTIONAL TO THE LARGEST BAR, NOT TO ZERO-BASED MONEY. The question a
 * reader asks of six months is "which were better", and scaling to the biggest
 * month answers it at the size this renders. It is emphatically NOT a chart to
 * read values off - which is why touching a month SHOWS you the figures, and
 * why there is no axis: an axis here would promise a precision the rendering
 * cannot keep.
 *
 * A ZERO MONTH STILL GETS A MARK. A bar of no height is indistinguishable from
 * a month that is missing, and the difference matters: one is "nothing was
 * collected", the other is "we are not showing you". So zero draws a hairline.
 */
export type TrendPoint = {
  label: string;
  /** The primary measure - the taller, accented bar. */
  value: number;
  /** The second measure, drawn beside it. Omit for a single series. */
  second?: number;
  /** What to say when this point is chosen. Pre-formatted; no arithmetic here. */
  caption?: string;
};

export function Trend({
  points,
  height = 64,
  legend,
}: {
  points: TrendPoint[];
  height?: number;
  /** Names the two series, when there are two. */
  legend?: { primary: string; secondary: string };
}) {
  /*
   * The LAST point, not none. A chart that says nothing until it is touched
   * wastes the line it occupies, and the month a reader cares about most is
   * almost always the one that just ended.
   */
  const [chosen, setChosen] = useState(points.length - 1);

  const largest = Math.max(...points.flatMap((point) => [point.value, point.second ?? 0]), 0);
  const selected = points[chosen];

  return (
    <View style={{ gap: space.sm }}>
      {legend ? (
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <Key className="bg-accent" label={legend.primary} />
          <Key className="bg-danger" label={legend.secondary} />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.xs, height }}>
        {points.map((point, index) => (
          <Pressable
            key={point.label}
            onPress={() => setChosen(index)}
            accessibilityRole="button"
            accessibilityLabel={point.caption ?? point.label}
            accessibilityState={{ selected: index === chosen }}
            style={{ flex: 1, height, justifyContent: 'flex-end' }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                gap: 2,
                /*
                  The chosen month is opaque and the rest are dimmed, rather
                  than the chosen one being a different colour. Colour here
                  already means which SERIES a bar belongs to, and a third
                  meaning on the same channel would make both unreadable.
                */
                opacity: index === chosen ? 1 : 0.45,
              }}
            >
              <Bar value={point.value} largest={largest} height={height} className="bg-accent" />

              {point.second !== undefined ? (
                <Bar value={point.second} largest={largest} height={height} className="bg-danger" />
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: space.xs }}>
        {points.map((point, index) => (
          <Text
            key={point.label}
            tone={index === chosen ? 'default' : 'muted'}
            style={{ ...type.rowMeta, flex: 1, textAlign: 'center' }}
          >
            {point.label}
          </Text>
        ))}
      </View>

      {selected?.caption ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Icon name="chevron" size={14} tone="muted" />
          <Text tone="muted" style={type.rowMeta}>
            {selected.caption}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * One bar, growing to its height once.
 *
 * ON MOUNT AND NOT ON CHANGE. This series is fetched once and refreshed
 * rarely; animating every refetch would make a background refresh look like
 * new money arriving. `useMotion` carries the reduced-motion answer, so a
 * person who has asked their device for less gets the bar at its height with
 * no travel at all.
 */
function Bar({
  value,
  largest,
  height,
  className,
}: {
  value: number;
  largest: number;
  height: number;
  className: string;
}) {
  const { ms, duration, easing } = useMotion();

  // A floor of 2pt, so an empty month reads as an empty month rather than as a
  // gap in the data. See the note on the component.
  const target = Math.max(largest > 0 ? Math.round((value / largest) * height) : 0, 2);

  const grown = useSharedValue(0);

  useEffect(() => {
    grown.value = withTiming(1, { duration: ms(duration.base), easing: easing.out });
  }, [grown, ms, duration.base, easing.out]);

  const style = useAnimatedStyle(() => ({ height: grown.value * target }));

  return <Animated.View className={className} style={[{ flex: 1, borderRadius: 3 }, style]} />;
}

function Key({ className, label }: { className: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
      <View className={className} style={{ width: 10, height: 10, borderRadius: 2 }} />
      <Text tone="muted" style={type.rowMeta}>
        {label}
      </Text>
    </View>
  );
}
