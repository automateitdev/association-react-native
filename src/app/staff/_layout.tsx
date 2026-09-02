import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '@/features/auth/session';

/**
 * The staff surface.
 *
 * Overview, Approvals, Members. The dashboard leads because it is the only
 * screen that answers "what needs doing" - a staff surface whose landing screen
 * is a work queue tells you about one kind of work and nothing about the rest.
 *
 * Still no room reserved for fee setup or reports: what those screens want will
 * be clear when they exist, and guessing now would only have to be undone.
 *
 * The guard mirrors the member layout - a member account reaching here would
 * hit staff endpoints and be refused by `EnsureStaff` with a 403 it cannot act
 * on.
 */
export default function StaffLayout() {
  const { isLoading, session, isStaff } = useSession();

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
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Overview' }} />
      <Tabs.Screen name="approvals" options={{ title: 'Approvals' }} />
      <Tabs.Screen name="members/index" options={{ title: 'Members' }} />
      <Tabs.Screen name="fees/index" options={{ title: 'Fees' }} />

      {/*
        Reached from the list, not chosen from the bar. Without href: null every
        file in this tree becomes its own tab, so "members/[id]" and
        "members/new" would appear beside the two real ones.
      */}
      <Tabs.Screen name="members/[id]" options={{ href: null }} />
      <Tabs.Screen name="members/new" options={{ href: null }} />
      <Tabs.Screen name="fees/[id]" options={{ href: null }} />
      <Tabs.Screen name="fees/new" options={{ href: null }} />
      <Tabs.Screen name="fees/assign" options={{ href: null }} />
    </Tabs>
  );
}
