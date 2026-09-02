import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '@/features/auth/session';

/**
 * The launch gate.
 *
 * Three questions, in this order (see session.tsx for why the order matters):
 *   association chosen? -> signed in? -> which role?
 */
export default function Index() {
  const { isLoading, tenantSlug, session, isStaff } = useSession();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!tenantSlug) return <Redirect href="/association" />;
  if (!session) return <Redirect href="/sign-in" />;

  // Role decides the whole navigation tree. One binary, two audiences
  // (ADR-0003).
  return <Redirect href={isStaff ? '/staff' : '/member'} />;
}
