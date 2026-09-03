import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useIsDesktop } from './breakpoint';
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
  icon,
  action,
  children,
  first = false,
}: {
  title?: string;
  /**
   * A glyph beside the heading.
   *
   * Optional and used sparingly. Section headings are small, letterspaced and
   * muted precisely so they are findable when scanning and invisible when
   * reading - an icon on every one of them would undo that. It earns its place
   * where a heading marks a change of KIND rather than just the next group:
   * the money on a dues screen, the download beside a table.
   */
  icon?: IconName;
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            {icon ? <Icon name={icon} size={14} tone="muted" /> : null}
            <Text tone="muted" style={{ ...type.section, textTransform: 'uppercase' }}>
              {title}
            </Text>
          </View>
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

/**
 * Where a screen's primary action goes.
 *
 * Buttons were rendering full-bleed - "Pay now" as a 1000pt green capsule
 * across the whole content column. That is a phone pattern, where a thumb needs
 * the width; on a desktop it reads as a banner and makes the page look like an
 * enlarged app rather than a built one.
 *
 * On a phone it still stretches, because there the original reason holds.
 */
export function Actions({
  children,
  align = 'start',
}: {
  children: ReactNode;
  align?: 'start' | 'stretch';
}) {
  const isDesktop = useIsDesktop();
  const stretch = align === 'stretch' || !isDesktop;

  return (
    <View
      style={{
        marginTop: space.lg,
        flexDirection: 'row',
        gap: space.sm,
        alignSelf: stretch ? 'stretch' : 'flex-start',
      }}
    >
      {children}
    </View>
  );
}

/**
 * The style a button inside `Actions` should carry.
 *
 * Paired buttons were written as `style={{ flex: 1 }}` - right on a phone, where
 * Cancel and Confirm split the screen between them, and absurd on a desktop,
 * where they split 1240pt and each came out 620pt wide. A confirm button the
 * width of half a monitor does not read as a button.
 *
 * A hook rather than a constant because the answer depends on the viewport, and
 * a hook is the only thing a component can ask at render time.
 */
export function useActionButtonStyle() {
  const isDesktop = useIsDesktop();

  // Wide enough for "Confirm reinstate" without wrapping; nowhere near the
  // width of the page.
  return isDesktop ? { minWidth: 150 } : { flex: 1 };
}
