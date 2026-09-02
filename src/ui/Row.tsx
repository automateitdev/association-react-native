import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Text';
import { Icon } from './Icon';
import { Divider } from './Section';
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
  divider?: boolean;
}) {
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
          trying rows that would have worked.
        */}
        {onPress ? <Icon name="chevron" size={18} tone="muted" /> : null}
      </View>

      {footer}
    </View>
  );

  return (
    <View>
      {onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body}
      {divider ? <Divider /> : null}
    </View>
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
