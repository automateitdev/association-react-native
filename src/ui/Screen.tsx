import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { useContentWidth, useIsDesktop } from './breakpoint';
import { space, type } from './tokens';

/**
 * Page frame: safe area, measure, and pull-to-refresh.
 *
 * Pull-to-refresh is not decoration here. A member pays at a bank counter and
 * then opens the app to see whether it has landed; letting them pull is the
 * difference between "the app is broken" and "not approved yet".
 *
 * The measure is now breakpoint-aware, and the fixed 720pt cap it replaces was
 * a mistake worth naming: it was introduced to stop rows running the full width
 * of a browser with text stranded at either end, which was a real problem - but
 * applying one phone-sized cap to every surface meant a desktop showed a narrow
 * column with 280pt of dead space on each side. The answer to "too wide" was
 * never "as narrow as a phone", it was a measure chosen per kind of screen.
 */
export function Screen({
  children,
  scroll = true,
  onRefresh,
  refreshing = false,
  width = 'wide',
}: {
  children: ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  /**
   * `reading` for forms and prose - a stretched text input looks broken and
   * long lines are harder to read. `wide` for lists, dashboards and tables,
   * where more visible at once is the whole point of a desktop.
   */
  width?: 'reading' | 'wide';
}) {
  const insets = useSafeAreaInsets();
  const maxWidth = useContentWidth(width);
  const isDesktop = useIsDesktop();

  const padding = {
    // The AppBar already clears the inset; adding it again double-padded the
    // top of every screen.
    paddingTop: space.lg,
    // Clears the tab bar as well as the home indicator.
    paddingBottom: insets.bottom + space.xxl,
    paddingHorizontal: space.lg,
  };

  /*
   * Left-aligned beside the sidebar, not centred in what is left over.
   *
   * Centring a capped column inside the remaining space looks fine at 1280 and
   * absurd at 1919: the sidebar ends at 220, the content began at 429, and the
   * 209pt band between them was simply empty. Nothing balanced it on the right
   * either - the page just looked broken in the middle.
   *
   * A sidebar is already the left edge of the layout. Content belongs against
   * it. On a phone there is no sidebar and nothing to align to, so it stays
   * centred there, where the cap never binds anyway.
   */
  const measure = {
    width: '100%' as const,
    maxWidth,
    alignSelf: (isDesktop ? 'flex-start' : 'center') as 'flex-start' | 'center',
  };

  /*
   * EVERY SCREEN PAINTS ITS OWN GROUND, and that is not cosmetic.
   *
   * react-navigation only truly hides an inactive tab when react-native-screens
   * is active. On web `screensEnabled()` is false, so its MaybeScreen falls back
   * to a plain View and inactive screens are merely pushed to `zIndex: -1` -
   * still mounted, still laid out, still painted. With transparent scenes the
   * result was every visited tab showing through every other one at identical
   * coordinates: five titles stacked on the same pixel.
   *
   * An opaque background on the focused screen is what actually covers them.
   * `bg-background` rather than a colour prop so it follows the theme through
   * CSS, which is the one mechanism that has proved reliable here.
   */
  if (!scroll) {
    return (
      <View className="bg-background" style={[{ flex: 1 }, padding]}>
        <View style={[{ flex: 1 }, measure]}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      className="bg-background"
      style={{ flex: 1 }}
      contentContainerStyle={padding}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
      }
    >
      {/*
        No blanket `gap` any more. Spacing used to be a flat 16pt between every
        child, which is why the screens had one rhythm and no hierarchy: a
        heading sat as far from its own content as from the section above it.
        Section owns its spacing now.
      */}
      <View style={measure}>{children}</View>
    </ScrollView>
  );
}

/**
 * The page title, and whatever single control belongs beside it.
 *
 * Every screen had its own hand-rolled header row, each with a different font
 * size and arrangement. One component means one answer.
 */
export function ScreenHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: space.md,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.title}>{title}</Text>
        {subtitle ? (
          <Text tone="muted" style={type.rowMeta}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {action}
    </View>
  );
}
