import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from './Text';
import { space, type } from './tokens';

/**
 * A group of related things, expressed with space rather than a box.
 *
 * This replaces the `Card` that used to wrap every section. A card says "this
 * is a distinct object"; most of what these screens group is not an object, it
 * is a heading and the rows beneath it. Using a container for that produced the
 * slab-on-slab look - and nested containers wherever a card held cards.
 *
 * The heading is small, letterspaced and muted on purpose: findable when
 * scanning, invisible when reading.
 */
export function Section({
  title,
  action,
  children,
  first = false,
}: {
  title?: string;
  /** A single control belonging to this section - "Add", "Edit". */
  action?: ReactNode;
  children: ReactNode;
  /** Tighter top margin. For the first section under a page title. */
  first?: boolean;
}) {
  return (
    <View style={{ marginTop: first ? space.md : space.xl }}>
      {title ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: space.sm,
            gap: space.md,
          }}
        >
          <Text tone="muted" style={{ ...type.section, textTransform: 'uppercase' }}>
            {title}
          </Text>
          {action}
        </View>
      ) : null}

      {children}
    </View>
  );
}

/**
 * A hairline.
 *
 * `border-border` rather than a hard-coded grey or an opacity: the theme
 * already defines what a divider is worth in light and dark, and picking a
 * value here would be right in one of them at best.
 */
export function Divider({ inset = 0 }: { inset?: number }) {
  return <View className="bg-border" style={{ height: 1, marginLeft: inset }} />;
}

/**
 * A surface for something that genuinely IS a distinct object - a confirmation
 * step, an error, a callout that must not be read as part of the flow.
 *
 * Deliberately rare, and the only place a filled surface is allowed. If this
 * appears three times on one screen, the screen has gone back to being blocky
 * and the answer is a Section.
 */
export function Panel({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <View
      className={
        tone === 'danger'
          ? 'bg-danger-soft border border-danger'
          : 'bg-background-secondary border border-border'
      }
      style={{
        padding: space.lg,
        borderRadius: 14,
        gap: space.sm,
      }}
    >
      {children}
    </View>
  );
}
