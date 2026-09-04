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
  const { isLoading, session, isStaff, signOut, tenantSlug, can } = useSession();
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

  /*
   * A tab's href, or null to leave it out of the bar.
   *
   * Returning `undefined` would mean "use the default", which is the route -
   * so the tab would appear. null is the only value that hides it.
   */
  const tab = (permission: string) => (can(permission) ? undefined : null);

  const signOutAndReturn = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <View style={{ flex: 1 }}>
      <AppBar
        association={association.data?.name ?? tenantSlug ?? 'Association'}
        userName={session.profile.name}
        userRole={session.role}
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

        // Beside the icon in a sidebar, below it in a bar - the usual reading
        // of each shape, and what leaves room for a full word.
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
         * Each tab names its own icon below. The navigator's placeholder glyph
         * was suppressed entirely for a while, because no icon set had been
         * chosen and five identical chevrons read as dropdown arrows - now
         * there is a set, so they carry meaning.
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
      {/*
        EVERY TAB IS GATED ON A PERMISSION, and this was a real gap once roles
        became something an association configures.

        A cashier - members.view and collections.* and nothing else - was shown
        Fees and Reports like everybody else, and pressing either got a 403 with
        no explanation. A navigation bar that offers places you may not go is
        not a cosmetic problem; it teaches staff that the app is unreliable.

        `href: null` is expo-router's way of keeping a route reachable while
        removing it from the bar, which is what a permission check needs: the
        screen still exists for a deep link, it simply is not offered.
      */}
      <Tabs.Screen
        name="index"
        options={{ tabBarIcon: tabIcon('overview'), title: 'Overview', href: tab('dashboard.view') }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          tabBarIcon: tabIcon('approvals'),
          title: 'Approvals',
          href: tab('payments.view'),
        }}
      />
      <Tabs.Screen
        name="collect"
        options={{ tabBarIcon: tabIcon('pay'), title: 'Collect', href: tab('collections.view') }}
      />
      <Tabs.Screen
        name="members/index"
        options={{ tabBarIcon: tabIcon('members'), title: 'Members', href: tab('members.view') }}
      />
      <Tabs.Screen
        name="fees/index"
        options={{ tabBarIcon: tabIcon('fees'), title: 'Fees', href: tab('fee-setups.view') }}
      />
      <Tabs.Screen
        name="reports/index"
        options={{
          tabBarIcon: tabIcon('reports'),
          title: 'Reports',
          // Either report is enough to make the menu worth showing.
          href: tab('reports.due') ?? tab('reports.paid'),
        }}
      />
      <Tabs.Screen
        name="admin/index"
        options={{
          tabBarIcon: tabIcon('settings'),
          title: 'Admin',
          /*
            Any of the four things the hub holds is enough to make it worth
            offering. An account with settings.view but no users.view still
            needs a way in - gating on users.view alone hid the whole hub from
            whoever configures the association.
          */
          href:
            tab('users.view') ??
            tab('roles.view') ??
            tab('settings.view') ??
            tab('ledgers.view') ??
            tab('associator.view'),
        }}
      />

      {/*
        Reached from a list, not chosen from the bar. Without href: null every
        file in this tree becomes its own tab.
      */}
      <Tabs.Screen name="admin/users" options={{ href: null }} />
      <Tabs.Screen name="admin/roles" options={{ href: null }} />
      <Tabs.Screen name="admin/settings" options={{ href: null }} />
      <Tabs.Screen name="admin/ledgers" options={{ href: null }} />
      <Tabs.Screen name="admin/register" options={{ href: null }} />
      <Tabs.Screen name="members/nominees" options={{ href: null }} />
      <Tabs.Screen name="fees/fines" options={{ href: null }} />
      <Tabs.Screen name="members/[id]" options={{ href: null }} />
      <Tabs.Screen name="members/new" options={{ href: null }} />
      <Tabs.Screen name="fees/[id]" options={{ href: null }} />
      <Tabs.Screen name="fees/new" options={{ href: null }} />
      <Tabs.Screen name="fees/assign" options={{ href: null }} />
      <Tabs.Screen name="reports/due" options={{ href: null }} />
      <Tabs.Screen name="reports/paid" options={{ href: null }} />
        </Tabs>
      </View>
    </View>
  );
}

/**
 * A tab's icon, sized and coloured by the navigator.
 *
 * The navigator hands back `ColorValue`, which covers platform colour objects
 * as well as strings. Only a string is useful to a Text style, so anything else
 * falls through to the icon's own tone rather than being cast and hoped for.
 */
function tabIcon(name: IconName) {
  return ({ color }: { color: ColorValue }) => (
    <Icon name={name} size={18} color={typeof color === 'string' ? color : undefined} />
  );
}
