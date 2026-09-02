import { Redirect, Tabs } from 'expo-router';
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
  const { session, isStaff } = useSession();

  if (!session) return <Redirect href="/sign-in" />;
  if (isStaff) return <Redirect href="/staff" />;

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Dues' }} />
      <Tabs.Screen name="pay" options={{ title: 'Pay' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
