import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '@/features/auth/session';

/**
 * The staff surface.
 *
 * A Stack for now rather than Tabs: there is one placeholder screen, and
 * choosing the navigation shape before the R-1 component inventory would be
 * guessing at how the report screens want to be laid out.
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
  if (!isStaff) return <Redirect href="/member" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
