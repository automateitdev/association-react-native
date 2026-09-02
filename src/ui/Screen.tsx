import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { maxContentWidth, space, type } from './tokens';

/**
 * Page frame: safe area, reading measure, and pull-to-refresh.
 *
 * Pull-to-refresh is not decoration here. A member pays at a bank counter and
 * then opens the app to see whether it has landed; letting them pull is the
 * difference between "the app is broken" and "not approved yet".
 *
 * The measure matters as much. React Native Web stretches to the viewport, so
 * on a desktop browser every row ran the full 1280pt with small text stranded
 * at either end - most of why the staff screens read as slabs. Capping and
 * centring costs phones nothing and fixes the browser entirely.
 */
export function Screen({
  children,
  scroll = true,
  onRefresh,
  refreshing = false,
}: {
  children: ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const insets = useSafeAreaInsets();

  const padding = {
    paddingTop: insets.top + space.md,
    // Clears the tab bar as well as the home indicator.
    paddingBottom: insets.bottom + space.xxl,
    paddingHorizontal: space.lg,
  };

  const measure = {
    width: '100%' as const,
    maxWidth: maxContentWidth,
    alignSelf: 'center' as const,
  };

  if (!scroll) {
    return (
      <View style={[{ flex: 1 }, padding]}>
        <View style={[{ flex: 1 }, measure]}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
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
