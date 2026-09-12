import { View } from 'react-native';
import { Text } from './Text';
import { space, type } from './tokens';

/**
 * A short series of figures as bars - six months of collections, say.
 *
 * NO CHART LIBRARY, and that is a deliberate limit rather than a stopgap. What
 * this draws is six rectangles and six labels; a charting dependency would
 * bring axes, tooltips, animation and a second theming system to do it, and
 * every one of those is a thing to keep in step with the rest of the app.
 *
 * PROPORTIONAL TO THE LARGEST BAR, NOT TO ZERO-BASED MONEY. The question a
 * reader asks of six months is "which were better", and scaling to the biggest
 * month answers it at the size this renders. It is emphatically NOT a chart to
 * read values off - the figures are written underneath for that, and the bars
 * carry no axis because an axis here would be a promise of precision the
 * rendering cannot keep.
 *
 * A ZERO MONTH STILL GETS A MARK. A bar of no height is indistinguishable from
 * a month that is missing, and the difference matters: one is "nothing was
 * collected", the other is "we are not showing you". So zero draws a hairline.
 */
export function Trend({
  points,
  height = 56,
}: {
  points: { label: string; value: number; caption?: string }[];
  height?: number;
}) {
  const largest = Math.max(...points.map((point) => point.value), 0);

  return (
    <View style={{ gap: space.sm }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: space.sm,
          height,
        }}
      >
        {points.map((point) => {
          /*
           * A floor of 2pt, so an empty month reads as an empty month rather
           * than as a gap in the data. See the note above.
           */
          const filled = largest > 0 ? Math.round((point.value / largest) * height) : 0;

          return (
            <View key={point.label} style={{ flex: 1, justifyContent: 'flex-end' }}>
              <View
                className={point.value > 0 ? 'bg-accent' : 'bg-border'}
                style={{
                  height: Math.max(filled, 2),
                  borderRadius: 3,
                }}
              />
            </View>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {points.map((point) => (
          <Text
            key={point.label}
            tone="muted"
            style={{ ...type.rowMeta, flex: 1, textAlign: 'center' }}
          >
            {point.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
