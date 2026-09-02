import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '@/features/auth/session';
import { useIsDesktop } from '@/ui';

/**
 * The staff surface.
 *
 * FIVE AREAS, AND THE NAVIGATION MOVES TO SUIT THE SCREEN.
 * On a phone they are bottom tabs. On anything desktop-shaped they are a left
 * sidebar, which is what `tabBarPosition: 'left'` gives - the same routes, the
 * same state, no second navigator to keep in step.
 *
 * This is not decoration. Staff work is desktop work: R-3 names React Native Web
 * as the surface where report-heavy admin actually happens, because it is
 * genuinely awkward on a phone. The first version pinned a bottom tab bar to the
 * bottom of a 1280pt browser window and capped content at 720pt, which looked
 * like a phone emulator with 280pt of dead space on either side. Five tabs also
 * made the labels too small to read; the same five in a sidebar have room for
 * full words.
 *
 * The guard mirrors the member layout - a member account reaching here would hit
 * staff endpoints and be refused by `EnsureStaff` with a 403 it cannot act on.
 */
export default function StaffLayout() {
  const { isLoading, session, isStaff } = useSession();
  const isDesktop = useIsDesktop();

  /*
   * Wait for the session check before deciding anything.
   *
   * Without this, a refresh or a deep link into any staff route redirects to
   * sign-in: at first render `session` is null because /me is still in flight,
   * and the guard fires on that null. The user IS signed in - the request
   * comes back 200 a moment later - but they have already been bounced.
   *
   * Only running the app surfaces this; the types are identical either way.
   */
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) return <Redirect href="/sign-in" />;
  if (!isStaff) return <Redirect href="/member" />;

  return (
    <Tabs
      /*
       * Remount when the layout changes shape.
       *
       * react-navigation reads `tabBarPosition` when the navigator mounts and
       * does not re-apply it from changed screenOptions, so without this a
       * browser dragged across the breakpoint kept whichever layout it started
       * with - a sidebar squeezed into 700pt, or bottom tabs on a full desktop -
       * until the page was reloaded. Verified: it needed a reload to switch.
       *
       * The cost is that crossing the breakpoint resets navigation state and
       * returns to the first tab. That is worth it: crossing 1024 is a rare and
       * deliberate act, and being stuck in the wrong layout is the worse of the
       * two. Ordinary resizing within a breakpoint remounts nothing.
       */
      key={isDesktop ? 'desktop' : 'phone'}
      screenOptions={{
        headerShown: false,
        tabBarPosition: isDesktop ? 'left' : 'bottom',

        // Beside the icon in a sidebar, below it in a bar - the usual reading
        // of each shape, and what leaves room for a full word.
        tabBarLabelPosition: isDesktop ? 'beside-icon' : 'below-icon',

        /*
         * No icon at all, rather than the navigator's placeholder.
         *
         * No icon set has been chosen for this app, so every tab was rendering
         * the default placeholder glyph - five identical chevrons that read as
         * dropdown arrows next to the labels. A word on its own is clearer than
         * a word beside a meaningless mark. Icons can come back when there is a
         * set worth using.
         */
        tabBarIcon: () => null,

        ...(isDesktop
          ? {
              tabBarStyle: { width: 220 },
              tabBarItemStyle: { justifyContent: 'flex-start', paddingHorizontal: 16 },
            }
          : null),
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Overview' }} />
      <Tabs.Screen name="approvals" options={{ title: 'Approvals' }} />
      <Tabs.Screen name="members/index" options={{ title: 'Members' }} />
      <Tabs.Screen name="fees/index" options={{ title: 'Fees' }} />
      <Tabs.Screen name="reports/index" options={{ title: 'Reports' }} />

      {/*
        Reached from a list, not chosen from the bar. Without href: null every
        file in this tree becomes its own tab.
      */}
      <Tabs.Screen name="members/[id]" options={{ href: null }} />
      <Tabs.Screen name="members/new" options={{ href: null }} />
      <Tabs.Screen name="fees/[id]" options={{ href: null }} />
      <Tabs.Screen name="fees/new" options={{ href: null }} />
      <Tabs.Screen name="fees/assign" options={{ href: null }} />
      <Tabs.Screen name="reports/due" options={{ href: null }} />
      <Tabs.Screen name="reports/paid" options={{ href: null }} />
    </Tabs>
  );
}
