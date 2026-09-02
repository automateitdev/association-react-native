import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '@/features/auth/session';

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
    <Tabs screenOptions={{ headerShown: false }}>
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
