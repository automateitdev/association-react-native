import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Page frame: safe area, padding, and pull-to-refresh.
 *
 * Pull-to-refresh is not decoration here. A member pays at a bank counter and
 * then opens the app to see whether it has landed; letting them pull is the
 * difference between "the app is broken" and "not approved yet".
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
    paddingTop: insets.top + 12,
    // Clears the tab bar as well as the home indicator.
    paddingBottom: insets.bottom + 24,
    paddingHorizontal: 16,
  };

  if (!scroll) {
    return <View style={[{ flex: 1 }, padding]}>{children}</View>;
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[{ gap: 16 }, padding]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
      }
    >
      {children}
    </ScrollView>
  );
}
