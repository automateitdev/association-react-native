import { Redirect, router, Tabs } from 'expo-router';
import { ActivityIndicator, View, type ColorValue } from 'react-native';
import { useAssociation } from '@/features/auth/association';
import { useSession } from '@/features/auth/session';
import { useTheme } from '@/features/theme';
import { AppBar, Icon, font, useIsDesktop, type IconName,
  NavSurface,
  useThemeColorReader,
} from '@/ui';

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
  const { isLoading, session, isStaff, signOut, tenantSlug } = useSession();
  const isDesktop = useIsDesktop();
  const association = useAssociation();
  const { preference, scheme, cycle } = useTheme();

  /*
   * The navigator tints the active tab from react-navigation's own theme, which
   * is a stock blue and knows nothing about HeroUI's palette. Left alone the
   * sidebar highlighted in blue while every other accent on screen was green.
   */
  const themeColor = useThemeColorReader(scheme);
  const accent = themeColor('accent');
  const accentForeground = themeColor('accent-foreground');
  const muted = themeColor('muted');

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

  const signOutAndReturn = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <View style={{ flex: 1 }}>
      <AppBar
        association={association.data?.name ?? tenantSlug ?? 'Association'}
        userName={session.profile.name}
        userRole={session.profile.membership_no ? `No. ${session.profile.membership_no}` : undefined}
        onSignOut={() => void signOutAndReturn()}
        themePreference={preference}
        onCycleTheme={cycle}
      />

      {/*
        The navigator needs its own flex: <Tabs> sits in a column beside the
        AppBar, so without this it is a flex child with no flex of its own.

        This is NOT what caused tabs to render on top of each other - that was
        transparent scenes, and is fixed in ui/Screen.tsx, which see. The two
        looked alike enough that this wrapper was tried first and did nothing.
      */}
      <View style={{ flex: 1 }}>
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
        /*
         * The tint sits ON the active pill, which the navigator paints with
         * `primary` - and primary is now the accent. Setting the tint to accent
         * as well made the active item green-on-green: a solid pill with its
         * label and icon invisible inside it. accent-foreground is the colour
         * the palette defines for exactly this, text on an accent ground.
         */
        /*
         * The active pill is painted EXPLICITLY, not left to the navigator.
         *
         * Relying on its default produced an invisible active tab: the label
         * took accent-foreground (near-black, correct for sitting on an accent
         * pill) while no pill was actually painted behind it, so the current
         * page's own nav entry vanished into the sidebar. Measured on the Fees
         * tab: label rgb(26,22,6), and not one element on the page painted in
         * the accent behind it.
         *
         * Setting both halves means the pair can never disagree again.
         */
        /*
         * The rail paints itself, because the navigator could not.
         *
         * Supplying this makes the navigator set its own background to
         * transparent (BottomTabBar.js: `tabBarBackgroundElement != null ?
         * 'transparent' : colors.card`), which is what we want - `colors.card`
         * was being dropped anyway and the rail was showing the page through
         * it.
         */
        tabBarBackground: () => <NavSurface scheme={scheme} sidebar={isDesktop} />,

        tabBarActiveBackgroundColor: accent,
        tabBarActiveTintColor: accentForeground,
        tabBarInactiveTintColor: muted,
        tabBarLabelPosition: isDesktop ? 'beside-icon' : 'below-icon',

        /*
         * The navigator styles its own labels, and its default is 17pt
         * system-ui - so the sidebar was the one place in the app not using
         * Inter and not on the type scale. Next to 13.5pt Inter content it read
         * as a different application bolted on the side, which is exactly what
         * "no consistency in fonts" looks like.
         */
        tabBarLabelStyle: {
          fontFamily: font.medium,
          fontSize: 13,
          fontWeight: '500' as const,
        },

        /*
         * No icon at all, rather than the navigator's placeholder.
         *
         * No icon set has been chosen for this app, so every tab was rendering
         * the default placeholder glyph - five identical chevrons that read as
         * dropdown arrows next to the labels. A word on its own is clearer than
         * a word beside a meaningless mark. Icons can come back when there is a
         * set worth using.
         */
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
              /*
               * borderRightWidth: 0 because the navigator draws its hairline
               * from `colors.border`, which React Native Web drops - leaving
               * borderColor at its initial value of pure black. NavSurface
               * draws the real one.
               */
              tabBarStyle: { width: 220, minWidth: 220, borderRightWidth: 0 },
              tabBarItemStyle: {
                justifyContent: 'flex-start',
                paddingHorizontal: 14,
                borderRadius: 8,
                marginHorizontal: 8,
              },
            }
          : { tabBarStyle: { borderTopWidth: 0 } }),
      }}
    >
      <Tabs.Screen name="index" options={{ tabBarIcon: tabIcon('dues'), title: 'Dues' }} />
      <Tabs.Screen name="pay" options={{ tabBarIcon: tabIcon('pay'), title: 'Pay' }} />
      <Tabs.Screen name="history" options={{ tabBarIcon: tabIcon('history'), title: 'History' }} />
      <Tabs.Screen name="profile" options={{ tabBarIcon: tabIcon('profile'), title: 'Profile' }} />

      {/*
        Expo Router turns every file in this directory into a tab. The payment
        detail screen is pushed from Pay and History, not chosen from the bar,
        so `href: null` keeps it routable while hiding it - otherwise a
        "payment/[id]" tab appears next to the four real ones.
      */}
      <Tabs.Screen name="payment/[id]" options={{ href: null }} />
        </Tabs>
      </View>
    </View>
  );
}

/** A tab's icon, sized and coloured by the navigator. */
function tabIcon(name: IconName) {
  return ({ color }: { color: ColorValue }) => (
    <Icon name={name} size={18} color={typeof color === 'string' ? color : undefined} />
  );
}
