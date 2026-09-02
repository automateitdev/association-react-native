import { Redirect, router, Tabs } from 'expo-router';
import { ActivityIndicator, View, type ColorValue } from 'react-native';
import { useAssociation } from '@/features/auth/association';
import { useSession } from '@/features/auth/session';
import { AppBar, Icon, useIsDesktop, type IconName } from '@/ui';
import { useThemeColor } from 'heroui-native';

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
  const { isLoading, session, isStaff, signOut, tenantSlug } = useSession();
  const isDesktop = useIsDesktop();
  const association = useAssociation();

  /*
   * The navigator tints the active tab from react-navigation's own theme, which
   * is a stock blue and knows nothing about HeroUI's palette. Left alone the
   * sidebar highlighted in blue while every other accent on screen was green.
   */
  const accent = useThemeColor('accent');
  const accentForeground = useThemeColor('accent-foreground');
  const muted = useThemeColor('muted');

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
      />

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
        tabBarActiveTintColor: accentForeground,
        tabBarInactiveTintColor: muted,

        // Beside the icon in a sidebar, below it in a bar - the usual reading
        // of each shape, and what leaves room for a full word.
        tabBarLabelPosition: isDesktop ? 'beside-icon' : 'below-icon',

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
              tabBarStyle: { width: 220, minWidth: 220 },
              tabBarItemStyle: { justifyContent: 'flex-start', paddingHorizontal: 16 },
            }
          : null),
      }}
    >
      <Tabs.Screen name="index" options={{ tabBarIcon: tabIcon('overview'), title: 'Overview' }} />
      <Tabs.Screen name="approvals" options={{ tabBarIcon: tabIcon('approvals'), title: 'Approvals' }} />
      <Tabs.Screen name="members/index" options={{ tabBarIcon: tabIcon('members'), title: 'Members' }} />
      <Tabs.Screen name="fees/index" options={{ tabBarIcon: tabIcon('fees'), title: 'Fees' }} />
      <Tabs.Screen name="reports/index" options={{ tabBarIcon: tabIcon('reports'), title: 'Reports' }} />

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
    <Icon name={name} size={22} color={typeof color === 'string' ? color : undefined} />
  );
}
