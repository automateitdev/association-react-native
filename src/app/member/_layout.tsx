import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '@/features/auth/session';
import { useIsDesktop } from '@/ui';

/**
 * The member surface.
 *
 * Four tabs, and no more. A member's needs are small and specific: see what
 * they owe, pay it, check it went through, keep their details current.
 * Everything else belongs to staff.
 *
 * The guard is not decoration - a staff account landing here would see member
 * screens that call member-only endpoints and fail confusingly.
 */
export default function MemberLayout() {
  const { isLoading, session, isStaff } = useSession();
  const isDesktop = useIsDesktop();

  /*
   * Wait for the session check before deciding anything.
   *
   * Without this, a refresh or a deep link into any member route redirects to
   * sign-in: at first render `session` is null because /me is still in flight,
   * and the guard fires on that null. The member IS signed in - the request
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
  if (isStaff) return <Redirect href="/staff" />;

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

        // Members are overwhelmingly on phones, but a member who opens this in
        // a browser should get a browser rather than a phone drawn in the
        // middle of their screen.
        tabBarPosition: isDesktop ? 'left' : 'bottom',
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
              /*
               * minWidth as well as width, and both are needed.
               *
               * The navigator applies its own `minWidth` from
               * getDefaultSidebarWidth - a flat 360 from the Material drawer
               * spec - and a minWidth beats a width, so setting width alone did
               * nothing and the rail sat at 360. Measured: 320 of the item at
               * 1280 before this.
               *
               * 360 is a drawer built to hold sections and descriptions. This
               * holds five one-word labels, and every pixel it does not take is
               * a pixel a report column can have.
               */
              tabBarStyle: { width: 220, minWidth: 220 },
              tabBarItemStyle: { justifyContent: 'flex-start', paddingHorizontal: 16 },
            }
          : null),
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dues' }} />
      <Tabs.Screen name="pay" options={{ title: 'Pay' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />

      {/*
        Expo Router turns every file in this directory into a tab. The payment
        detail screen is pushed from Pay and History, not chosen from the bar,
        so `href: null` keeps it routable while hiding it - otherwise a
        "payment/[id]" tab appears next to the four real ones.
      */}
      <Tabs.Screen name="payment/[id]" options={{ href: null }} />
    </Tabs>
  );
}
