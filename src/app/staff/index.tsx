import { router } from 'expo-router';
import { useSession } from '@/features/auth/session';
import { Button, Card, Screen, Text } from '@/ui';

/**
 * Placeholder for the staff surface.
 *
 * Staff screens are not built yet. This route exists so that a staff account
 * signing in lands somewhere honest instead of being redirected to member
 * screens that call member-only endpoints and fail confusingly.
 *
 * The build order is deliberate: the staff screens need components HeroUI
 * Native does not ship - there is no table, data grid, pagination control or
 * date picker among its 43 components - so the inventory in risk R-1 comes
 * before the screens, not after.
 */
export default function StaffPlaceholderScreen() {
  const { session, signOut } = useSession();

  return (
    <Screen>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Staff access</Text>

      <Card>
        <Card.Body style={{ gap: 8 }}>
          <Text>
            Signed in as {session?.profile.name} ({session?.role}).
          </Text>
          <Text>
            The staff screens are not built yet. Member management, fee setup, approvals and
            reports are available through the API.
          </Text>
        </Card.Body>
      </Card>

      <Button
        variant="secondary"
        onPress={async () => {
          await signOut();
          router.replace('/');
        }}
      >
        <Button.Label>Sign out</Button.Label>
      </Button>
    </Screen>
  );
}
